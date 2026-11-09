import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse } from "yaml";
import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { formatFinancialBlockPath } from "./financialIssueMessages";

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
 * Comprueba los bloques de componentes de un documento Markdown con los mismos
 * esquemas que usa el renderizado, sin renderizar. Informa de todos los
 * problemas de cada bloque. Una fence con un nombre casi correcto
 * (`financial-chartt`) se señala, porque de otro modo se publicaría en silencio
 * como código normal.
 */
export function validateMarkdownBlocks(
  markdown: string,
  definitions: readonly ComponentBlockDefinition[],
): readonly MarkdownBlockIssue[] {
  const tree = unified().use(remarkParse).parse(markdown) as unknown as MarkdownNode;
  const byName = new Map(definitions.map((definition) => [definition.name, definition]));
  const known = definitions.map(({ name }) => name);
  const issues: MarkdownBlockIssue[] = [];

  for (const fence of codeFences(tree)) {
    const lang = fence.lang;
    if (!lang) continue;
    const line = fence.position?.start.line ?? 0;

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
