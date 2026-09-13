import { join, relative, resolve, sep } from "node:path";
import { toDocumentId } from "../../../shared/utils/documentPath";
import { InvalidDocumentIdError } from "../../domain/errors";

const DEFAULT_CONTENT_DIR = "./src/content";

function resolveContentDir(contentDir: string = DEFAULT_CONTENT_DIR): string {
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
  contentDir: string = DEFAULT_CONTENT_DIR
): string {
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
  contentDir: string = DEFAULT_CONTENT_DIR
): string {
  const contentRoot = resolveContentDir(contentDir);
  const relativePath = relative(contentRoot, filePath).replace(/\\/g, "/");
  return toDocumentId(relativePath, { lowercase: false });
}
