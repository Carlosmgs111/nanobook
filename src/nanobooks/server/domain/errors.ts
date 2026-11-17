export class InvalidNanobookError extends Error {
  constructor(message: string) {
    super(`Nanobook inválido: ${message}`);
    this.name = "InvalidNanobookError";
  }
}

export class InvalidNanobookSlugError extends Error {
  constructor(public readonly value: string) {
    super(`Slug de nanobook inválido: ${value}`);
    this.name = "InvalidNanobookSlugError";
  }
}

export class NanobookNotFoundError extends Error {
  constructor(public readonly identifier: string) {
    super(`El nanobook "${identifier}" no existe`);
    this.name = "NanobookNotFoundError";
  }
}

export class NanobookRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NanobookRepositoryError";
  }
}

export class NanobookSlugAlreadyTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`El slug de nanobook "${slug}" ya está en uso`);
    this.name = "NanobookSlugAlreadyTakenError";
  }
}
