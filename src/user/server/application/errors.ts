export class UserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`El usuario "${userId}" no existe`);
    this.name = "UserNotFoundError";
  }
}
