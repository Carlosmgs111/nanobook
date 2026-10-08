export class InvalidUsernameError extends Error {
  constructor(public readonly value: string) {
    super(`Nombre de usuario inválido: ${value}`);
    this.name = "InvalidUsernameError";
  }
}

export class InvalidProfileError extends Error {
  constructor(message: string) {
    super(`Perfil inválido: ${message}`);
    this.name = "InvalidProfileError";
  }
}

export class ProfileRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ProfileRepositoryError";
    this.cause = options?.cause;
  }
}

export class UsernameAlreadyTakenError extends Error {
  constructor(public readonly username: string) {
    super(`El nombre de usuario "${username}" ya está en uso`);
    this.name = "UsernameAlreadyTakenError";
  }
}
