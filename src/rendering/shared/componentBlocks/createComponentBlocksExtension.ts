import type { Comment, Element, ElementContent, Root, RootContent } from "hast";
import { parse } from "yaml";
import type { MarkdownExtension } from "../MarkdownExtension";
import { BLOCK_END_COMMENT, blockStartComment } from "./blockMarker";
import type { BlockRegistry } from "./registerBlocks";

/** Sube cuando cambia la forma del HTML que emite la extensión: invalida la caché de páginas. */
const COMPONENT_BLOCKS_VERSION = "2";

function fenceOf(node: Element): { language: string; source: string } | undefined {
  if (node.tagName !== "pre" || node.children.length !== 1) return;
  const [code] = node.children;
  if (code.type !== "element" || code.tagName !== "code") return;

  const classes = code.properties.className;
  const className = Array.isArray(classes) && classes.length === 1 ? classes[0] : classes;
  if (typeof className !== "string" || !className.startsWith("language-")) return;

  const source = code.children
    .filter((child) => child.type === "text")
    .map((child) => child.value)
    .join("");
  return { language: className.slice("language-".length), source };
}

function errorBlock(name: string, message: string): Element {
  return {
    type: "element",
    tagName: "div",
    properties: { className: ["component-block", "component-block-error"], role: "alert" },
    children: [{ type: "text", value: `Componente "${name}" inválido: ${message}` }],
  };
}

function mountPoint(name: string, props: unknown, fallback: Element): Element {
  const children: ElementContent[] = [fallback];
  return {
    type: "element",
    tagName: "div",
    properties: {
      className: ["component-block"],
      dataComponent: name,
      dataProps: JSON.stringify(props),
    },
    children,
  };
}

interface Resolved {
  readonly replacement: Element;
  /** Presente solo si el contenido era válido; los errores no llevan marcadores. */
  readonly block?: { readonly name: string; readonly props: unknown };
}

function resolve(node: Element, blocks: Pick<BlockRegistry, "find">): Resolved | undefined {
  const fence = fenceOf(node);
  const definition = fence && blocks.find(fence.language);
  if (!fence || !definition) return undefined;

  try {
    const parsed = definition.props.safeParse(parse(fence.source));
    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
        .join("; ");
      return { replacement: errorBlock(definition.name, reason) };
    }
    return {
      replacement: mountPoint(definition.name, parsed.data, node),
      block: { name: definition.name, props: parsed.data },
    };
  } catch {
    return { replacement: errorBlock(definition.name, "el contenido no es YAML ni JSON válido") };
  }
}

function comment(value: string): Comment {
  return { type: "comment", value };
}

/**
 * Convierte fences cuyo lenguaje coincide con un componente registrado en un
 * punto de montaje `<div data-component data-props>`. El bloque de código
 * original queda dentro como contenido alternativo hasta que el cliente monte.
 *
 * Los bloques que son hijos directos de la raíz del documento se rodean además
 * con un par de comentarios (`blockMarker`) para poder partir el HTML en
 * segmentos sin cortar ningún elemento. Los anidados (listas, citas…) no los
 * llevan: cortar dentro de ellos rompería la etiqueta que los contiene.
 */
export function createComponentBlocksExtension(blocks: Pick<BlockRegistry, "find">): MarkdownExtension {

  function visitNested(parent: Element): void {
    parent.children.forEach((child, index) => {
      if (child.type !== "element") return;
      const resolved = resolve(child, blocks);
      if (resolved) parent.children[index] = resolved.replacement;
      else visitNested(child);
    });
  }

  return {
    id: "component-blocks",
    version: COMPONENT_BLOCKS_VERSION,
    transform(tree: Root) {
      tree.children = tree.children.flatMap((node): RootContent[] => {
        if (node.type !== "element") return [node];

        const resolved = resolve(node, blocks);
        if (!resolved) {
          visitNested(node);
          return [node];
        }
        if (!resolved.block) return [resolved.replacement];

        return [
          comment(blockStartComment(resolved.block.name, resolved.block.props)),
          resolved.replacement,
          comment(BLOCK_END_COMMENT),
        ];
      });
    },
  };
}
