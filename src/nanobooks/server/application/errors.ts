export class NanobookNotFoundError extends Error {
  constructor(public readonly identifier: string) {
    super(`El nanobook "${identifier}" no existe`);
    this.name = "NanobookNotFoundError";
  }
}
