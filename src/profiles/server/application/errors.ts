export { UsernameAlreadyTakenError } from "../domain/errors";

export class ProfileAlreadyExistsError extends Error {
  constructor(public readonly userId: string) {
    super(`El usuario "${userId}" ya tiene un perfil`);
    this.name = "ProfileAlreadyExistsError";
  }
}

export class ProfileNotFoundError extends Error {
  constructor(public readonly value: string) {
    super(`El perfil "${value}" no existe`);
    this.name = "ProfileNotFoundError";
  }
}
