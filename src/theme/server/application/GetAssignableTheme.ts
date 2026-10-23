import { Result } from "../../../shared/domain/Result";
import { InvalidThemeError } from "../domain/errors";
import type { ThemeRepository } from "../domain/ports/ThemeRepository";
import type { ThemeReference } from "../../../shared/theme/ThemeReference";
import { findOwned } from "./ownership";
import { OfficialThemeCatalog } from "../infraestructure/OfficialThemeCatalog";

export class GetAssignableTheme {
  constructor(private readonly repository: ThemeRepository) {}
  async execute(ownerId: string, reference: ThemeReference): Promise<Result<Error, ThemeReference>> {
    if (reference.kind === "official") {
      return new OfficialThemeCatalog().get(reference.id).id === reference.id
        ? Result.ok(reference)
        : Result.fail(new InvalidThemeError("la referencia oficial no existe"));
    }
    if (reference.kind !== "custom") return Result.fail(new InvalidThemeError("la referencia es inválida"));
    const found = await findOwned(this.repository, ownerId, reference.id);
    return found.isSuccess ? Result.ok(reference) : Result.fail(found.getError());
  }
}
