import { Result } from "../../shared/domain/Result";
import { InvalidDocumentIdError } from "./errors";

const ALLOWED_ID_PATTERN = /^[\p{L}\p{N}_-]+$/u;

export class DocumentId {
  static generate(): DocumentId {
    return new DocumentId(crypto.randomUUID());
  }
  static validateNotEmpty(id: string): boolean {
    return !!id;
  }

  static validateAllowedCharacters(id: string): boolean {
    return ALLOWED_ID_PATTERN.test(id);
  }

  static validate(id: string): InvalidDocumentIdError | null {
    if (!DocumentId.validateNotEmpty(id)) {
      return new InvalidDocumentIdError(id);
    }
    if (!DocumentId.validateAllowedCharacters(id)) {
      return new InvalidDocumentIdError(id);
    }
    return null;
  }

  static create(id: string): Result<InvalidDocumentIdError, DocumentId> {
    const validationError = DocumentId.validate(id);
    if (validationError) {
      return Result.fail(validationError);
    }
    return Result.ok(new DocumentId(id));
  }

  private constructor(private readonly value: string) {}

  getValue(): string {
    return this.value;
  }

}
