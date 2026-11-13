import { BLOCK_NAME_PATTERN } from "./blockMarker";
import type { ComponentBlockDefinition } from "./ComponentBlockDefinition";

/** Ruta de un componente `.astro` desde la raíz del proyecto, como `/src/<módulo>/…/Nombre.astro`. */
const COMPONENT_PATH_PATTERN = /^\/src\/.+\.astro$/;

export interface BlockRegistry {
  /** Los bloques registrados hasta ahora. */
  readonly blocks: readonly ComponentBlockDefinition[];
  find(name: string): ComponentBlockDefinition | undefined;
  /**
   * Registra bloques. Cada módulo registra los suyos al componerse, de modo que
   * solo existen los de los módulos que la aplicación necesita. Falla, nombrando
   * el bloque, si un nombre no es válido o está repetido, o si la ruta del
   * componente no es un `.astro` bajo `/src/`; en ese caso no registra ninguno.
   */
  register(definitions: readonly ComponentBlockDefinition[]): void;
}

export function createBlockRegistry(): BlockRegistry {
  const byName = new Map<string, ComponentBlockDefinition>();

  return {
    get blocks() {
      return [...byName.values()];
    },
    find: (name) => byName.get(name),
    register(definitions) {
      const next = new Map(byName);
      for (const definition of definitions) {
        const { name, component } = definition;
        if (!BLOCK_NAME_PATTERN.test(name)) {
          throw new Error(`Nombre de bloque inválido "${name}": debe cumplir ${BLOCK_NAME_PATTERN}`);
        }
        if (!COMPONENT_PATH_PATTERN.test(component)) {
          throw new Error(`Bloque "${name}": el componente debe ser la ruta de un .astro bajo /src/ (recibido: ${component})`);
        }
        if (next.has(name)) {
          throw new Error(`Bloque duplicado "${name}"`);
        }
        next.set(name, definition);
      }
      byName.clear();
      for (const [name, definition] of next) byName.set(name, definition);
    },
  };
}
