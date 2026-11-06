import type { Element, ElementContent, Root } from "hast";
import { parse } from "yaml";
import type { MarkdownExtension } from "../MarkdownExtension";
import type { ComponentBlockDefinition } from "./ComponentBlockDefinition";

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

/**
 * Convierte fences cuyo lenguaje coincide con un componente registrado en un
 * punto de montaje `<div data-component data-props>`. El bloque de código
 * original queda dentro como contenido alternativo hasta que el cliente monte.
 */
export function createComponentBlocksExtension(options: {
  readonly id: string;
  readonly version: string;
  readonly definitions: readonly ComponentBlockDefinition[];
}): MarkdownExtension {
  const byName = new Map(options.definitions.map((definition) => [definition.name, definition]));

  return {
    id: options.id,
    version: options.version,
    fenceLanguages: [...byName.keys()],
    transform(tree) {
      function visit(parent: Root | Element): void {
        parent.children.forEach((node, index) => {
          if (node.type !== "element") return;
          const fence = fenceOf(node);
          const definition = fence && byName.get(fence.language);
          if (!fence || !definition) {
            visit(node);
            return;
          }

          try {
            const parsed = definition.props.safeParse(parse(fence.source));
            parent.children[index] = parsed.success
              ? mountPoint(definition.name, parsed.data, node)
              : errorBlock(
                  definition.name,
                  parsed.error.issues.map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`).join("; "),
                );
          } catch {
            parent.children[index] = errorBlock(definition.name, "el contenido no es YAML ni JSON válido");
          }
        });
      }

      visit(tree);
    },
  };
}
