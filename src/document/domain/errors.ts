import { InfrastructureError } from "../../shared/errors";

export class DocumentRepositoryError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DocumentRepositoryError";
  }
}

export class DocumentParseError extends InfrastructureError {
  constructor(
    public readonly documentId: string,
    options?: { cause?: unknown }
  ) {
    super(`Failed to parse document "${documentId}"`, options);
    this.name = "DocumentParseError";
  }
}

export class DocumentAlreadyExistsError extends Error {
  constructor(public readonly documentId: string) {
    super(`El documento "${documentId}" ya existe`);
    this.name = "DocumentAlreadyExistsError";
  }
}

export class DocumentNotFoundError extends Error {
  constructor(public readonly documentId: string) {
    super(`El documento "${documentId}" no existe`);
    this.name = "DocumentNotFoundError";
  }
}

export class InvalidDocumentIdError extends Error {
  constructor(public readonly documentId: string) {
    super(`Id de documento inválido: ${documentId}`);
    this.name = "InvalidDocumentIdError";
  }
}

export class ParentNotFoundError extends Error {
  constructor(public readonly parentId: string) {
    super(`El documento padre "${parentId}" no existe`);
    this.name = "ParentNotFoundError";
  }
}

export class InvalidDocumentError extends Error {
  constructor(public readonly documentId: string, message: string) {
    super(`Documento inválido "${documentId}": ${message}`);
    this.name = "InvalidDocumentError";
  }
}

export class InvalidIndexDocumentError extends Error {
  constructor(
    public readonly documentId: string,
    public readonly isIndex: boolean,
    public readonly metadata: any
  ) {
    super(
      `Inconsistencia de índice: el id "${documentId}" ${
        isIndex ? "es" : "no es"
      } de índice pero metadata.index=${metadata.index}`
    );
    this.name = "InvalidIndexDocumentError";
  }
}

export type DocumentServiceError =
  | DocumentAlreadyExistsError
  | DocumentNotFoundError
  | InvalidDocumentIdError
  | ParentNotFoundError
  | InvalidDocumentError;
