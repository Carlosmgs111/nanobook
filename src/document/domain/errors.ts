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
  constructor(public readonly documentId: DocumentId | string) {
    const id = typeof documentId === "string" ? documentId : documentId.getValue();
    super(`Id de documento inválido: ${id}`);
    this.name = "InvalidDocumentIdError";
  }
}

export class ParentNotFoundError extends Error {
  constructor(public readonly parentId: DocumentId) {
    super(`El documento padre "${parentId.getValue()}" no existe`);
    this.name = "ParentNotFoundError";
  }
}

export class InvalidDocumentError extends Error {
  constructor(
    public readonly documentId: string,
    message: string
  ) {
    super(`Documento inválido "${documentId}": ${message}`);
    this.name = "InvalidDocumentError";
  }
}

export type DocumentServiceError =
  | DocumentAlreadyExistsError
  | DocumentNotFoundError
  | InvalidDocumentIdError
  | ParentNotFoundError
  | InvalidDocumentError;