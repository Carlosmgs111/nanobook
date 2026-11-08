import { join } from "node:path";
import { discoverBlocks, type ImportModule } from "./discoverBlocks";
import { relativeImportPath, renderHostSource } from "./renderHostSource";

export interface GeneratedFile {
  readonly path: string;
  readonly content: string;
}

/** Carpeta, dentro de `src`, donde viven los archivos generados. */
export const GENERATED_DIRECTORY = ["application", "browser", "ui", "generated"] as const;

/**
 * Calcula el contenido que deben tener los archivos generados. Lo usan el script
 * que los escribe y la prueba que comprueba que los versionados no están
 * desactualizados, de modo que ambos no pueden divergir.
 */
export async function buildGeneratedFiles(srcRoot: string, importModule?: ImportModule): Promise<GeneratedFile[]> {
  const directory = join(srcRoot, ...GENERATED_DIRECTORY);
  const blocks = await discoverBlocks(srcRoot, importModule);
  const { host, ssrBlockNames } = renderHostSource(
    blocks.map(({ name, componentFile }) => ({ name, importPath: relativeImportPath(directory, componentFile) })),
  );

  return [
    { path: join(directory, "ComponentBlockHost.astro"), content: host },
    { path: join(directory, "ssrBlockNames.ts"), content: ssrBlockNames },
  ];
}
