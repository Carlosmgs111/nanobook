import { relative } from "node:path";
import type { BlockHydration } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";

export interface HostEntry {
  readonly name: string;
  /** Directiva `client:*`; ausente = solo HTML del servidor. */
  readonly hydrate?: BlockHydration;
  /** Ruta de importación del componente, relativa al archivo generado y con `/`. */
  readonly importPath: string;
}

const GENERATED_NOTICE = "GENERADO por scripts/generate-component-blocks.ts. No editar a mano.";

/** Ruta relativa con `/` (también en Windows) y con prefijo `./` cuando no sube de nivel. */
export function relativeImportPath(fromDirectory: string, file: string): string {
  const path = relative(fromDirectory, file).replaceAll("\\", "/");
  return path.startsWith(".") ? path : `./${path}`;
}

/**
 * Genera el texto del host de Astro y de la lista de nombres que sabe pintar.
 * Astro solo hidrata componentes importados directamente en un `.astro` y usados
 * con una etiqueta estática, por eso cada componente tiene su propia línea.
 * Un bloque sin `hydrate` se pinta sin directiva: HTML del servidor, sin JS.
 * La salida es determinista: no depende del orden de entrada ni de la fecha.
 */
export function renderHostSource(entries: readonly HostEntry[]): { host: string; ssrBlockNames: string } {
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const imports = sorted.map(({ importPath }, index) => `import Block${index} from ${JSON.stringify(importPath)};`);
  // Astro solo acepta la directiva escrita como literal en la plantilla.
  const tags = sorted.map(({ name, hydrate }, index) => {
    const directive = hydrate === undefined ? "" : ` client:${hydrate}`;
    return `{name === ${JSON.stringify(name)} && <Block${index} {...blockProps}${directive} />}`;
  });

  const host = [
    "---",
    `// ${GENERATED_NOTICE}`,
    ...imports,
    ...(imports.length > 0 ? [""] : []),
    "interface Props {",
    "  name: string;",
    "  props: Record<string, unknown>;",
    "}",
    "",
    "const { name, props } = Astro.props;",
    "const blockProps = props as never;",
    "---",
    "",
    ...(tags.length > 0 ? tags : ["{/* Sin componentes de framework registrados. */}"]),
    "",
  ].join("\n");

  const ssrBlockNames = [
    `// ${GENERATED_NOTICE}`,
    `export const ssrBlockNames: ReadonlySet<string> = new Set<string>(${JSON.stringify(sorted.map(({ name }) => name))});`,
    "",
  ].join("\n");

  return { host, ssrBlockNames };
}
