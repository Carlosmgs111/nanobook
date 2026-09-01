import type { DocumentId } from "./DocumentId";

export class DocumentAlreadyExistsError extends Error {
  constructor(public readonly documentId: DocumentId) {
    super(`El documento "${documentId.getValue()}" ya existe`);
    this.name = "DocumentAlreadyExistsError";
  }
}

export class DocumentNotFoundError extends Error {
  constructor(public readonly documentId: DocumentId) {
    super(`El documento "${documentId.getValue()}" no existe`);
    this.name = "DocumentNotFoundError";
  }
}

export class InvalidDocumentIdError extends Error {
  constructor(public readonly documentId: DocumentId) {
    super(`Id de documento inválido: ${documentId.getValue()}`);
    this.name = "InvalidDocumentIdError";
  }
}

export class ParentNotFoundError extends Error {
  constructor(public readonly parentId: DocumentId) {
    super(`El documento padre "${parentId.getValue()}" no existe`);
    this.name = "ParentNotFoundError";
  }
}

export type DocumentServiceError =
  | DocumentAlreadyExistsError
  | DocumentNotFoundError
  | InvalidDocumentIdError
  | ParentNotFoundError
  | Error;