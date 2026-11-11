import { blockRegistry } from "../../shared/blocks";

type AstroComponent = (props: Record<string, unknown>) => unknown;

/**
 * Tabla de búsqueda ruta → módulo. El registro (`blocks.ts`) decide qué bloques
 * existen; esto solo resuelve el `.astro` de cada uno. Los módulos se cargan al
 * primer uso.
 */
const loaders = import.meta.glob<{ default: AstroComponent }>("/src/*/browser/components/*/*.astro");

const missing = blockRegistry.blocks.filter(({ component }) => !(component in loaders));
if (missing.length > 0) {
  throw new Error(
    `Bloques registrados con un componente que no existe: ${missing
      .map(({ name, component }) => `${name} → ${component}`)
      .join(", ")}`,
  );
}

/** El componente `.astro` registrado para `name`, o `undefined` si no hay tal bloque. */
export async function loadBlockComponent(name: string): Promise<AstroComponent | undefined> {
  const block = blockRegistry.find(name);
  return block ? (await loaders[block.component]()).default : undefined;
}
