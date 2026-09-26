import { InfrastructureError } from "../../shared/errors";

export class EditionStorageError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EditionStorageError";
  }
}

export class EditionRenderError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EditionRenderError";
  }
}

export class EditionWriterError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EditionWriterError";
  }
}

export class InvalidDocumentContentError extends Error {
  constructor(public readonly reason: string) {
    super(`Contenido de documento inválido: ${reason}`);
    this.name = "InvalidDocumentContentError";
  }
}

export type EditionServiceError =
  | EditionStorageError
  | EditionRenderError
  | EditionWriterError
  | InvalidDocumentContentError;
