import { join, relative, resolve, sep } from "node:path";
import { toDocumentId } from "../../../../shared/utils/documentPath";
import { InvalidDocumentIdError } from "../../domain/errors";

const DEFAULT_CONTENT_DIR = "./src/content";

function resolveContentDir(contentDir: string = DEFAULT_CONTENT_DIR): string {
  return resolve(contentDir);
}

/**
 * Convierte una ruta interna de documento en la ruta de archivo correspondiente.
 *
 * - "index" -> src/content/index.md
 * - "blog/index" -> src/content/blog/index.md
 * - "blog/post" -> src/content/blog/post.md
 */
export function pathToFilePath(
  path: string,
  contentDir: string = DEFAULT_CONTENT_DIR
): string {
  const contentRoot = resolveContentDir(contentDir);
  const relativePath = path === "index" ? "index.md" : `${path}.md`;
  const filePath = resolve(join(contentRoot, relativePath));

  if (!filePath.startsWith(contentRoot + sep) && filePath !== contentRoot) {
    throw new InvalidDocumentIdError(path);
  }

  return filePath;
}

export function filePathToId(
  filePath: string,
  contentDir: string = DEFAULT_CONTENT_DIR
): string {
  const contentRoot = resolveContentDir(contentDir);
  const relativePath = relative(contentRoot, filePath).replace(/\\/g, "/");
  return toDocumentId(relativePath, { lowercase: false });
}
