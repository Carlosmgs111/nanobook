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
