import { InvalidDocumentIdError } from "./errors";

const ALLOWED_ID_PATTERN = /^(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+$/u;
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export class DocumentId {
  constructor(private readonly value: string) {
    this.validate();
  }
  getValue(): string {
    return this.cleanId();
  }
  isIndexId(): boolean {
    return this.value === "index" || this.value.endsWith("/index");
  }

  getParentId(): DocumentId | null {
    const normalizedId = this.normalize();
    if (normalizedId === "index") return null;
    const lastSlash = normalizedId.lastIndexOf("/");
    const parentId =
      lastSlash === -1 ? "index" : normalizedId.slice(0, lastSlash);
    return new DocumentId(parentId);
  }
  normalize(): string {
    if (this.value === "index") return "index";
    if (this.value.endsWith("/index")) {
      return this.value.slice(0, -"/index".length) || "index";
    }
    return this.value;
  }

  private isExternalOrAnchor(href: string): boolean {
    return (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("//") ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    );
  }

  private normalizeAbsolutePath(href: string): string {
    return href.replace(/^\//, "").replace(/\.md$/, "");
  }

  private normalizeRef(ref: string): string {
    return ref.replace(/\.md$/, "").replace(/\/index$/, "");
  }

   extractInternalLinkTargets(
    content: string
  ): string[] {
    const targets = new Set<string>();

    for (const match of content.matchAll(MARKDOWN_LINK_REGEX)) {
      const href = match[2];

      if (!href || this.isExternalOrAnchor(href)) continue;

      let targetId: string;

      if (href.startsWith("/")) {
        targetId = this.normalizeAbsolutePath(href);
      } else {
        targetId = this.resolveDocumentReference(href);
      }

      if (targetId && targetId !== this.getValue()) {
        targets.add(targetId);
      }
    }

    return Array.from(targets);
  }

  resolveDocumentReference(
    ref: string,
  ): string {
    const refPath = this.normalizeRef(ref);
    const refSegments = refPath.split("/").filter(Boolean);

    const sourceSegments =
      this.getValue() === "index"
        ? []
        : this.isIndexId()
          ? this.getValue().split("/")
          : this.getValue().split("/").slice(0, -1);

    const targetSegments: string[] = [...sourceSegments];
    for (const segment of refSegments) {
      if (segment === ".") continue;
      if (segment === "..") {
        targetSegments.pop();
      } else {
        targetSegments.push(segment);
      }
    }

    return targetSegments.join("/") || "index";
  }

  private cleanId(): string {
    const withoutExt = this.value.replace(/\.md$/, "");
    if (withoutExt.endsWith("/index")) {
      return (withoutExt.slice(0, -"/index".length) || "index").toLowerCase();
    }
    return withoutExt.toLowerCase();
  }

  private validate(): void {
    if (!this.value) {
      throw new InvalidDocumentIdError(this);
    }

    if (this.value.startsWith("/") || this.value.endsWith("/")) {
      throw new InvalidDocumentIdError(this);
    }

    const segments = this.value.split("/");
    for (const segment of segments) {
      if (segment === "." || segment === "..") {
        throw new InvalidDocumentIdError(this);
      }
    }

    if (!ALLOWED_ID_PATTERN.test(this.value)) {
      throw new InvalidDocumentIdError(this);
    }
  }
}
