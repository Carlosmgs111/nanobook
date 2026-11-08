import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { buildGeneratedFiles } from "../src/application/server/generateComponentBlocks/buildGeneratedFiles";

const projectRoot = join(import.meta.dirname, "..");

function currentContent(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8").replaceAll("\r\n", "\n");
  } catch {
    return undefined;
  }
}

try {
  const files = await buildGeneratedFiles(join(projectRoot, "src"));

  for (const { path, content } of files) {
    const label = relative(projectRoot, path).replaceAll("\\", "/");
    // Solo se escribe si cambia, para no provocar recargas innecesarias en desarrollo.
    if (currentContent(path) === content) {
      console.log(`Sin cambios: ${label}`);
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
    console.log(`Generado: ${label}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
