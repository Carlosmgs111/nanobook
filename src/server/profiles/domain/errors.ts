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
