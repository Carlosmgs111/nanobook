import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { BLOCK_NAME_PATTERN } from "../../../rendering/shared/componentBlocks/blockMarker";
import {
  BLOCK_HYDRATION_DIRECTIVES,
  type BlockHydration,
} from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";

export interface BlockEntry {
  readonly name: string;
  readonly hydrate?: BlockHydration;
  readonly blockFile: string;
  readonly componentFile: string;
}

export type ImportModule = (file: string) => Promise<unknown>;

const BLOCK_SUFFIX = ".block.ts";
const COMPONENT_EXTENSIONS = [".astro", ".tsx", ".jsx", ".vue", ".svelte"] as const;

const importFromDisk: ImportModule = (file) => import(pathToFileURL(file).href);

function listFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function readDefinition(
  blockFile: string,
  importModule: ImportModule,
): Promise<{ name: string; hydrate?: BlockHydration }> {
  const module = (await importModule(blockFile)) as
    | { default?: { name?: unknown; hydrate?: unknown } }
    | undefined;
  const name = module?.default?.name;
  if (typeof name !== "string") {
    throw new Error(`${blockFile}: debe exportar por defecto una definición de bloque con "name" y "props"`);
  }
  if (!BLOCK_NAME_PATTERN.test(name)) {
    throw new Error(`${blockFile}: el nombre de bloque "${name}" debe cumplir ${BLOCK_NAME_PATTERN}`);
  }
  const hydrate = module?.default?.hydrate;
  if (hydrate === undefined) return { name };
  if (!(BLOCK_HYDRATION_DIRECTIVES as readonly unknown[]).includes(hydrate)) {
    throw new Error(
      `${blockFile}: hydrate "${String(hydrate)}" no es válido (${BLOCK_HYDRATION_DIRECTIVES.join(", ")})`,
    );
  }
  return { name, hydrate: hydrate as BlockHydration };
}

/**
 * Busca los pares `Nombre.block.ts` + `Nombre.<ext>` de cada
 * `src/<módulo>/browser/components/`. Un componente sin `.block.ts` es un
 * componente corriente y se ignora. Cualquier incoherencia detiene la generación.
 */
export async function discoverBlocks(
  srcRoot: string,
  importModule: ImportModule = importFromDisk,
): Promise<BlockEntry[]> {
  const modules = readdirSync(srcRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const entries: BlockEntry[] = [];
  const fileByName = new Map<string, string>();

  for (const module of modules) {
    const directory = join(srcRoot, module, "browser", "components");
    const files = listFiles(directory);

    for (const file of files.filter((candidate) => candidate.endsWith(BLOCK_SUFFIX)).sort()) {
      const blockFile = join(directory, file);
      const base = file.slice(0, -BLOCK_SUFFIX.length);

      const siblings = COMPONENT_EXTENSIONS.map((extension) => `${base}${extension}`).filter((candidate) =>
        files.includes(candidate),
      );
      if (siblings.length === 0) {
        throw new Error(`${blockFile} no tiene un componente hermano (${COMPONENT_EXTENSIONS.join(", ")})`);
      }
      if (siblings.length > 1) {
        throw new Error(`${blockFile} tiene más de un componente hermano: ${siblings.join(", ")}`);
      }

      const { name, hydrate } = await readDefinition(blockFile, importModule);
      const componentFile = join(directory, siblings[0]);
      if (hydrate !== undefined && componentFile.endsWith(".astro")) {
        throw new Error(`${blockFile}: un componente .astro no se hidrata en el navegador; quita "hydrate"`);
      }
      const existing = fileByName.get(name);
      if (existing !== undefined) {
        throw new Error(`Nombre de bloque duplicado "${name}": ${existing} y ${blockFile}`);
      }
      fileByName.set(name, blockFile);

      entries.push({ name, hydrate, blockFile, componentFile });
    }
  }

  return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
