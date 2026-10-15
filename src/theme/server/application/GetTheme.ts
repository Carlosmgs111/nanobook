import { Result } from "../../../shared/domain/Result";
import type { ThemeRepository } from "../domain/ports/ThemeRepository";
import { toThemeDetails, type ThemeDetails } from "./dto/ThemeDtos";
import { findOwned } from "./ownership";

export class GetTheme {
  constructor(private readonly repository: ThemeRepository) {}
  async execute(ownerId: string, id: string): Promise<Result<Error, ThemeDetails>> {
    const found = await findOwned(this.repository, ownerId, id);
    return found.isSuccess ? Result.ok(toThemeDetails(found.getValue())) : Result.fail(found.getError());
  }
}
