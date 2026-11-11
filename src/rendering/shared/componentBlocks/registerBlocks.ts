import { BLOCK_NAME_PATTERN } from "./blockMarker";
import type { ComponentBlockDefinition } from "./ComponentBlockDefinition";

/** Ruta de un componente `.astro` desde la raíz del proyecto, como `/src/<módulo>/…/Nombre.astro`. */
const COMPONENT_PATH_PATTERN = /^\/src\/.+\.astro$/;

export interface BlockRegistry {
  readonly blocks: readonly ComponentBlockDefinition[];
  find(name: string): ComponentBlockDefinition | undefined;
}

/**
 * Registra explícitamente los bloques que `rendering` puede pintar. Cada módulo
 * declara los suyos y la raíz de composición los junta. Falla, nombrando el
 * bloque, si un nombre no es válido o está repetido, o si la ruta del componente
 * no es un `.astro` bajo `/src/`.
 */
export function registerBlocks(definitions: readonly ComponentBlockDefinition[]): BlockRegistry {
  const byName = new Map<string, ComponentBlockDefinition>();

  for (const definition of definitions) {
    const { name, component } = definition;
    if (typeof name !== "string" || !BLOCK_NAME_PATTERN.test(name)) {
      throw new Error(`Nombre de bloque inválido "${String(name)}": debe cumplir ${BLOCK_NAME_PATTERN}`);
    }
    if (typeof component !== "string" || !COMPONENT_PATH_PATTERN.test(component)) {
      throw new Error(`Bloque "${name}": el componente debe ser la ruta de un .astro bajo /src/ (recibido: ${String(component)})`);
    }
    if (byName.has(name)) {
      throw new Error(`Bloque duplicado "${name}"`);
    }
    byName.set(name, definition);
  }

  return { blocks: [...byName.values()], find: (name) => byName.get(name) };
}
