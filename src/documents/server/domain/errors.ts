import { InfrastructureError } from "../../../shared/errors";

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

export class DocumentRevisionConflictError extends Error {
  constructor(
    public readonly documentId: string,
    public readonly expectedRevision: number,
    public readonly actualRevision?: number,
  ) {
    super(
      `El documento "${documentId}" cambió desde la revisión ${expectedRevision}`,
    );
    this.name = "DocumentRevisionConflictError";
  }
}

export class DocumentAccessDeniedError extends Error {
  constructor(public readonly documentId: string) {
    super(`No tienes permiso para modificar el documento "${documentId}"`);
    this.name = "DocumentAccessDeniedError";
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

export type DocumentServiceError =
  | DocumentAlreadyExistsError
  | DocumentAccessDeniedError
  | DocumentNotFoundError
  | DocumentRevisionConflictError
  | InvalidDocumentIdError
  | ParentNotFoundError
  | InvalidDocumentError;
