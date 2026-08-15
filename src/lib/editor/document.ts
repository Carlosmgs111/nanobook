import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

const CONTENT_DIR = "./src/content";
const ALLOWED_ID_PATTERN = /^(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+$/u;

function idToFilePath(id: string): string {
  if (!ALLOWED_ID_PATTERN.test(id)) {
    throw new Error(`Id de documento inválido: ${id}`);
  }

  const filePath = resolve(join(CONTENT_DIR, `${id}.md`));
  const contentRoot = resolve(CONTENT_DIR);

  if (!filePath.startsWith(contentRoot + sep) && filePath !== contentRoot) {
    throw new Error(`Id de documento fuera del directorio de contenido: ${id}`);
  }

  return filePath;
}

export async function saveDocument(id: string, content: string): Promise<void> {
  const filePath = idToFilePath(id);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}
