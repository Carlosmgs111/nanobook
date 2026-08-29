import { join, relative, resolve, sep } from "node:path";
import { InvalidDocumentIdError } from "../model/errors";

const DEFAULT_CONTENT_DIR = "./src/content";
const ALLOWED_ID_PATTERN = /^(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+$/u;

/**
 * Determina si un id representa explícitamente un índice de directorio.
 * Los ids normalizados (p. ej. "blog") no son detectados por esta función;
 * usa `normalizeDocumentId` primero si es necesario.
 */
export function isIndexId(id: string): boolean {
  return id === "index" || id.endsWith("/index");
}

/**
 * Normaliza un id de documento para que sea consistente con la convención de
 * `filePathToId`: los índices de directorio se representan sin el segmento
 * final `index`.
 *
 * - "index" -> "index"
 * - "blog/index" -> "blog"
 * - "blog/post" -> "blog/post"
 */
export function normalizeDocumentId(id: string): string {
  if (id === "index") return "index";
  if (id.endsWith("/index")) {
    return id.slice(0, -"/index".length) || "index";
  }
  return id;
}

export function validateDocumentId(id: string): void {
  if (!id) {
    throw new InvalidDocumentIdError("");
  }

  if (id.startsWith("/") || id.endsWith("/")) {
    throw new InvalidDocumentIdError(id);
  }

  const segments = id.split("/");
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new InvalidDocumentIdError(id);
    }
  }

  if (!ALLOWED_ID_PATTERN.test(id)) {
    throw new InvalidDocumentIdError(id);
  }
}

export function resolveContentDir(contentDir: string = DEFAULT_CONTENT_DIR): string {
  return resolve(contentDir);
}

/**
 * Convierte un id de documento en la ruta de archivo correspondiente.
 *
 * - "index" con isIndex=true -> src/content/index.md
 * - "blog" con isIndex=true -> src/content/blog/index.md
 * - "blog/post" con isIndex=false -> src/content/blog/post.md
 */
export function idToFilePath(
  id: string,
  isIndex: boolean,
  contentDir: string = DEFAULT_CONTENT_DIR,
): string {
  validateDocumentId(id);

  const contentRoot = resolveContentDir(contentDir);
  const relativePath = isIndex
    ? id === "index"
      ? "index.md"
      : `${id}/index.md`
    : `${id}.md`;
  const filePath = resolve(join(contentRoot, relativePath));

  if (!filePath.startsWith(contentRoot + sep) && filePath !== contentRoot) {
    throw new InvalidDocumentIdError(id);
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
  const parentId = lastSlash === -1 ? "index" : id.slice(0, lastSlash);
  return parentId;
}
