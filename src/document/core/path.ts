import { join, relative, resolve, sep } from "node:path";

const DEFAULT_CONTENT_DIR = "./src/content";
const ALLOWED_ID_PATTERN = /^(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+$/u;

export function resolveContentDir(contentDir: string = DEFAULT_CONTENT_DIR): string {
  return resolve(contentDir);
}

export function idToFilePath(
  id: string,
  contentDir: string = DEFAULT_CONTENT_DIR,
): string {
  if (!ALLOWED_ID_PATTERN.test(id)) {
    throw new Error(`Id de documento inválido: ${id}`);
  }

  const filePath = resolve(join(resolveContentDir(contentDir), `${id}.md`));
  const contentRoot = resolveContentDir(contentDir);

  if (!filePath.startsWith(contentRoot + sep) && filePath !== contentRoot) {
    throw new Error(`Id de documento fuera del directorio de contenido: ${id}`);
  }

  return filePath;
}

export function filePathToId(
  filePath: string,
  contentDir: string = DEFAULT_CONTENT_DIR,
): string {
  const contentRoot = resolveContentDir(contentDir);
  const relativePath = relative(contentRoot, filePath).replace(/\\/g, "/");
  const withoutExt = relativePath.replace(/\.md$/, "");

  // blog/index.md -> blog, index.md -> index
  if (withoutExt.endsWith("/index")) {
    return withoutExt.slice(0, -"/index".length) || "index";
  }

  return withoutExt;
}

export function getParentId(id: string): string | null {
  if (id === "index") return null;
  const lastSlash = id.lastIndexOf("/");
  return lastSlash === -1 ? "index" : id.slice(0, lastSlash);
}
