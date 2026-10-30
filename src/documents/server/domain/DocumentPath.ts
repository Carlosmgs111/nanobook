import { Result } from "../../../shared/domain/Result";
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
    private readonly internalValue: string,
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
    return Result.ok(
      new DocumentPath(canonical || "index", normalized, indexPath)
    );
  }

  /** Ruta interna, incluyendo `/index` cuando representa un índice. */
  getInternalValue(): string {
    return this.internalValue;
  }

  /** Ruta pública usada por navegación y URLs, sin el sufijo `/index`. */
  getPublicValue(): string {
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

  /** Ruta interna del índice que representa el directorio padre. */
  getInternalParentPath(): DocumentPath | null {
    const publicPath = this.getPublicValue();
    if (publicPath === "index") return null;
    const lastSlash = publicPath.lastIndexOf("/");
    const parentPublic = lastSlash === -1
      ? "index"
      : publicPath.slice(0, lastSlash);
    const parentInternal = parentPublic === "index"
      ? "index"
      : `${parentPublic}/index`;
    const result = DocumentPath.create(parentInternal);
    return result.isSuccess ? result.getValue() : null;
  }

  resolveReference(reference: string): DocumentPath | null {
    const ref = reference.split(/[?#]/, 1)[0]
      .replace(/\.md$/, "")
      .replace(/\/index$/, "");
    if (!ref) return null;
    const sourceSegments =
      this.getPublicValue() === "index"
        ? []
        : this.isIndex()
          ? this.getPublicValue().split("/")
          : this.getPublicValue().split("/").slice(0, -1);

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
        ? href.split(/[?#]/, 1)[0].replace(/^\//, "").replace(/\.md$/, "")
        : this.resolveReference(href)?.getPublicValue();
      const targetResult = target ? DocumentPath.create(target) : null;
      const normalizedTarget = targetResult?.isSuccess
        ? targetResult.getValue().getPublicValue()
        : null;
      if (normalizedTarget && normalizedTarget !== this.getPublicValue()) {
        targets.add(normalizedTarget);
      }
    }
    return Array.from(targets);
  }

  private static normalizeValue(path: string): string {
    return path.replace(/^\/+|\/+$/g, "").replace(/\.md$/, "").toLowerCase();
  }
}
