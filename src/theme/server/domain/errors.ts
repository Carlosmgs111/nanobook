export class InvalidThemeError extends Error {
  constructor(message: string) {
    super(`Tema inválido: ${message}`);
    this.name = "InvalidThemeError";
  }
}

export class ThemeRepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ThemeRepositoryError";
  }
}
