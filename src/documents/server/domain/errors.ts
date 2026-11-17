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

/** El actor no puede escribir en el nanobook; subclase para que los mapeos 403 existentes la cubran. */
export class WriteAccessDeniedError extends DocumentAccessDeniedError {
  constructor(public readonly nanobookId: string) {
    super(nanobookId);
    this.message = `No tienes permiso de edición sobre el nanobook "${nanobookId}"`;
    this.name = "WriteAccessDeniedError";
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

export class InvalidDocumentPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDocumentPasswordError";
  }
}

export class DocumentUnlockFailedError extends Error {
  constructor() {
    super("Contraseña incorrecta");
    this.name = "DocumentUnlockFailedError";
  }
}

export class DocumentUnlockRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Demasiados intentos. Inténtalo de nuevo más tarde.");
    this.name = "DocumentUnlockRateLimitedError";
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
