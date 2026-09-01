import { join, relative, resolve, sep } from "node:path";
import { InvalidDocumentIdError } from "../_domain/errors";
import type { DocumentId } from "../_domain/DocumentId";
import type { DocumentPathMapper } from "../_domain/DocumentPathMapper";

const DEFAULT_CONTENT_DIR = "./src/content";

export class DocumentFilePathMapper implements DocumentPathMapper {
  /**
   * Convierte un id de documento en la ruta de archivo correspondiente.
   *
   * - "index" con isIndex=true -> src/content/index.md
   * - "blog" con isIndex=true -> src/content/blog/index.md
   * - "blog/post" con isIndex=false -> src/content/blog/post.md
   */
  idToFilePath(
    id: DocumentId,
    isIndex: boolean,
    contentDir: string = DEFAULT_CONTENT_DIR
  ): string {
    const contentRoot = resolve(contentDir);
    const relativePath = isIndex
      ? id.getValue() === "index"
        ? "index.md"
        : `${id.getValue()}/index.md`
      : `${id.getValue()}.md`;
    const filePath = resolve(join(contentRoot, relativePath));

    if (!filePath.startsWith(contentRoot + sep) && filePath !== contentRoot) {
      throw new InvalidDocumentIdError(id);
    }

    return filePath;
  }

  filePathToId(
    filePath: string,
    contentDir: string = DEFAULT_CONTENT_DIR
  ): string {
    const contentRoot = resolve(contentDir);
    const relativePath = relative(contentRoot, filePath).replace(/\\/g, "/");
    const withoutExt = relativePath.replace(/\.md$/, "");

    // blog/index.md -> blog, index.md -> index
    if (withoutExt.endsWith("/index")) {
      return withoutExt.slice(0, -"/index".length) || "index";
    }

    return withoutExt;
  }
}
