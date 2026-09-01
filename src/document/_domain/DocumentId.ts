import { InvalidDocumentIdError } from "./errors";

const ALLOWED_ID_PATTERN = /^(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+$/u;

export class DocumentId {
  constructor(private readonly value: string) {
    this.validate();
  }

  getValue(): string {
    return this.value;
  }
  /**
   * Determina si un id representa explícitamente un índice de directorio.
   * Los ids normalizados (p. ej. "blog") no son detectados por esta función;
   * usa `normalizeDocumentId` primero si es necesario.
   */
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

  /**
   * Normaliza un id de documento para que sea consistente con la convención de
   * `filePathToId`: los índices de directorio se representan sin el segmento
   * final `index`.
   *
   * - "index" -> "index"
   * - "blog/index" -> "blog"
   * - "blog/post" -> "blog/post"
   */
   normalize(): string {
    if (this.value === "index") return "index";
    if (this.value.endsWith("/index")) {
      return this.value.slice(0, -"/index".length) || "index";
    }
    return this.value;
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
