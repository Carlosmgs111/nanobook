import { InfrastructureError } from "../../../shared/errors";

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
  public readonly status?: number;
  public readonly expectedRevision?: number;
  public readonly actualRevision?: number;

  constructor(
    message: string,
    options?: {
      cause?: unknown;
      status?: number;
      expectedRevision?: number;
      actualRevision?: number;
    }
  ) {
    super(message, options);
    this.name = "EditionWriterError";
    this.status = options?.status;
    this.expectedRevision = options?.expectedRevision;
    this.actualRevision = options?.actualRevision;
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
