import { Result } from "../../shared/domain/Result";
import { InvalidDocumentIdError } from "./errors";

const ALLOWED_PATH_PATTERN = /^(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+$/u;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Ubicación mutable de un documento dentro del árbol de contenido.
 *
 * No representa la identidad del documento. Puede cambiar cuando el
 * documento se mueve o se renombra.
 */
export class DocumentPath {
  private constructor(
    private readonly value: string,
    private readonly indexPath: boolean
  ) {}

  static create(path: string): Result<InvalidDocumentIdError, DocumentPath> {
    const normalized = DocumentPath.normalizeValue(path);
    if (!normalized || !ALLOWED_PATH_PATTERN.test(normalized)) {
      return Result.fail(new InvalidDocumentIdError(path));
    }
    const indexPath = normalized === "index" || normalized.endsWith("/index");
    const canonical = indexPath && normalized !== "index"
      ? normalized.slice(0, -"/index".length)
      : normalized;
    return Result.ok(new DocumentPath(canonical || "index", indexPath));
  }

  static fromLegacyId(id: string): Result<InvalidDocumentIdError, DocumentPath> {
    return DocumentPath.create(id);
  }

  getValue(): string {
    return this.value;
  }

  isIndex(): boolean {
    return this.indexPath;
  }

  normalized(): string {
    return this.value;
  }

  getParentPath(): DocumentPath | null {
    const normalized = this.normalized();
    if (normalized === "index") return null;
    const lastSlash = normalized.lastIndexOf("/");
    const parent = lastSlash === -1 ? "index" : normalized.slice(0, lastSlash);
    const result = DocumentPath.create(parent);
    return result.isSuccess ? result.getValue() : null;
  }

  resolveReference(reference: string): DocumentPath | null {
    const ref = reference.replace(/\.md$/, "").replace(/\/index$/, "");
    const sourceSegments =
      this.getValue() === "index"
        ? []
        : this.isIndex()
          ? this.getValue().split("/")
          : this.getValue().split("/").slice(0, -1);

    const targetSegments = [...sourceSegments];
    for (const segment of ref.split("/").filter(Boolean)) {
      if (segment === ".") continue;
      if (segment === "..") targetSegments.pop();
      else targetSegments.push(segment);
    }

    const result = DocumentPath.create(targetSegments.join("/") || "index");
    return result.isSuccess ? result.getValue() : null;
  }

  extractInternalLinkTargets(content: string): string[] {
    const targets = new Set<string>();
    for (const match of content.matchAll(MARKDOWN_LINK_REGEX)) {
      const href = match[2];
      if (!href || href.startsWith("http://") || href.startsWith("https://") ||
        href.startsWith("//") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        continue;
      }
      const target = href.startsWith("/")
        ? href.replace(/^\//, "").replace(/\.md$/, "")
        : this.resolveReference(href)?.getValue();
      if (target && target !== this.getValue()) targets.add(target);
    }
    return Array.from(targets);
  }

  private static normalizeValue(path: string): string {
    return path.replace(/^\/+|\/+$/g, "").replace(/\.md$/, "").toLowerCase();
  }
}
