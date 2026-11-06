import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse } from "yaml";
import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { financialComponentBlockDefinitions } from "../components/priceChart";
import { formatFinancialBlockPath } from "../parsing/FinancialBlockParseError";
import { isFinancialFenceKind, parseFinancialBlock } from "../parsing/parseFinancialBlock";
import { financialBlockSchemas } from "./FinancialBlockSchemas";

/** Un problema concreto de un bloque dentro de un documento Markdown. */
export interface MarkdownBlockIssue {
  /** Nombre de la fence (`financial-chart`, `price-chart`, …). */
  readonly block: string;
  /** Línea (desde 1) donde empieza la fence. */
  readonly line: number;
  /** Ruta del campo afectado; vacía si afecta a todo el bloque. */
  readonly path: string;
  readonly message: string;
}

const NEAR_MISS_PREFIXES = ["financial-", "company-", "price-"];

function knownBlockNames(definitions: readonly ComponentBlockDefinition[]): string[] {
  return [...Object.keys(financialBlockSchemas), ...definitions.map(({ name }) => name)];
}

/** Forma mínima del árbol mdast que se necesita aquí; evita depender de `@types/mdast`. */
interface MarkdownNode {
  readonly type: string;
  readonly lang?: string | null;
  readonly value?: string;
  readonly position?: { readonly start: { readonly line: number } };
  readonly children?: readonly MarkdownNode[];
}

function codeFences(node: MarkdownNode, found: MarkdownNode[] = []): MarkdownNode[] {
  if (node.type === "code") found.push(node);
  for (const child of node.children ?? []) codeFences(child, found);
  return found;
}

function validateComponentBlock(definition: ComponentBlockDefinition, source: string, line: number): MarkdownBlockIssue[] {
  let payload: unknown;
  try {
    payload = parse(source);
  } catch {
    return [{ block: definition.name, line, path: "", message: "El contenido debe ser un documento YAML válido." }];
  }
  const parsed = definition.props.safeParse(payload);
  if (parsed.success) return [];
  return parsed.error.issues.map((issue) => ({
    block: definition.name,
    line,
    path: formatFinancialBlockPath(issue.path.filter((part): part is string | number => typeof part !== "symbol")),
    message: issue.message,
  }));
}

/**
 * Comprueba los bloques financieros y de componentes de un documento Markdown
 * con los mismos parsers y esquemas que usa el renderizado, sin renderizar.
 *
 * Los bloques financieros informan solo del primer problema de cada uno, como
 * hace el parser; los de componentes informan de todos. Una fence con un
 * nombre casi correcto (`financial-chartt`) se señala, porque de otro modo se
 * publicaría en silencio como código normal.
 */
export function validateMarkdownBlocks(
  markdown: string,
  definitions: readonly ComponentBlockDefinition[] = financialComponentBlockDefinitions,
): readonly MarkdownBlockIssue[] {
  const tree = unified().use(remarkParse).parse(markdown) as unknown as MarkdownNode;
  const byName = new Map(definitions.map((definition) => [definition.name, definition]));
  const known = knownBlockNames(definitions);
  const issues: MarkdownBlockIssue[] = [];

  for (const fence of codeFences(tree)) {
    const lang = fence.lang;
    if (!lang) continue;
    const line = fence.position?.start.line ?? 0;

    if (isFinancialFenceKind(lang)) {
      const result = parseFinancialBlock(lang, fence.value ?? "");
      if (!result.isSuccess) {
        const error = result.getError();
        issues.push({ block: lang, line, path: formatFinancialBlockPath(error.path), message: error.message });
      }
      continue;
    }

    const definition = byName.get(lang);
    if (definition) {
      issues.push(...validateComponentBlock(definition, fence.value ?? "", line));
      continue;
    }

    if (NEAR_MISS_PREFIXES.some((prefix) => lang.startsWith(prefix))) {
      issues.push({
        block: lang,
        line,
        path: "",
        message: `«${lang}» no es un bloque conocido y se publicará como código. Bloques válidos: ${known.join(", ")}.`,
      });
    }
  }

  return issues;
}
