import { InfrastructureError } from "../../shared/errors";

export class DocumentRepositoryError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DocumentRepositoryError";
  }
}

export class DocumentStorageError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DocumentStorageError";
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

export class DocumentNotificationError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DocumentNotificationError";
  }
}
