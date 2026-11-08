import { BLOCK_NAME_PATTERN } from "../../rendering/shared/componentBlocks/blockMarker";
import type { ComponentBlockDefinition } from "../../rendering/shared/componentBlocks/ComponentBlockDefinition";

type BlockModules = Readonly<Record<string, { readonly default?: ComponentBlockDefinition }>>;

/**
 * Reúne las definiciones exportadas por los módulos `*.block.ts` y comprueba
 * que sean utilizables: export por defecto, nombre permitido y sin repetirse.
 * El orden es el de la ruta del módulo, para que el resultado sea determinista.
 */
export function collectFrameworkBlockDefinitions(modules: BlockModules): readonly ComponentBlockDefinition[] {
  const definitions: ComponentBlockDefinition[] = [];
  const pathByName = new Map<string, string>();

  for (const path of Object.keys(modules).sort()) {
    const definition = modules[path].default;
    if (!definition || typeof definition.name !== "string") {
      throw new Error(`${path}: debe exportar por defecto una definición de bloque con "name" y "props"`);
    }
    if (!BLOCK_NAME_PATTERN.test(definition.name)) {
      throw new Error(`${path}: el nombre de bloque "${definition.name}" debe cumplir ${BLOCK_NAME_PATTERN}`);
    }
    const existing = pathByName.get(definition.name);
    if (existing !== undefined) {
      throw new Error(`Nombre de bloque duplicado "${definition.name}" en ${existing} y ${path}`);
    }
    pathByName.set(definition.name, path);
    definitions.push(definition);
  }

  return definitions;
}

// Los `*.block.ts` son TypeScript puro (sin framework), así que Vite puede
// resolverlos en servidor, Worker y pruebas. El componente hidratado, en cambio,
// no se puede descubrir así: ver el host generado.
const modules = import.meta.glob<{ default?: ComponentBlockDefinition }>("/src/*/browser/components/*.block.ts", {
  eager: true,
});

const definitions = collectFrameworkBlockDefinitions(modules);
const byName = new Map(definitions.map((definition) => [definition.name, definition]));

export function listFrameworkBlockDefinitions(): readonly ComponentBlockDefinition[] {
  return definitions;
}

export function findFrameworkBlockDefinition(name: string): ComponentBlockDefinition | undefined {
  return byName.get(name);
}
