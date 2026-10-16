export class ThemeNotFoundError extends Error {
  constructor() { super("El tema no existe"); this.name = "ThemeNotFoundError"; }
}
export class ThemeAccessDeniedError extends Error {
  constructor() { super("No puedes acceder a este tema"); this.name = "ThemeAccessDeniedError"; }
}
