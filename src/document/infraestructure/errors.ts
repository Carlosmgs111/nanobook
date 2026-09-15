import { InfrastructureError } from "../../shared/errors";

export class DocumentStorageError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DocumentStorageError";
  }
}

// Re-exportados para compatibilidad con tests existentes.
export { DocumentRepositoryError, DocumentParseError } from "../domain/errors";
