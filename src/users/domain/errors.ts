export class InvalidUserIdError extends Error {
  constructor(public readonly value: string) {
    super(`Id de usuario inválido: ${value}`);
    this.name = "InvalidUserIdError";
  }
}

export class InvalidUserError extends Error {
  constructor(message: string) {
    super(`Usuario inválido: ${message}`);
    this.name = "InvalidUserError";
  }
}

export class UserRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "UserRepositoryError";
    this.cause = options?.cause;
  }
}

export class UserEmailAlreadyExistsError extends Error {
  constructor(public readonly email: string) {
    super(`El email "${email}" ya está registrado`);
    this.name = "UserEmailAlreadyExistsError";
  }
}
