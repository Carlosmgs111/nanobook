import { Result } from "../../../shared/domain/Result";
import { Theme } from "../domain/Theme";
import { InvalidThemeError } from "../domain/errors";
import type { ThemeRepository } from "../domain/ports/ThemeRepository";
import { parseThemeTokensDto, toThemeDetails, type ThemeDetails, type ThemeTokensDto } from "./dto/ThemeDtos";
import { findOwned } from "./ownership";

export class UpdateTheme {
  constructor(private readonly repository: ThemeRepository) {}
  async execute(ownerId: string, id: string, input: { name?: string; tokens?: ThemeTokensDto }): Promise<Result<Error, ThemeDetails>> {
    if (!input || typeof input !== "object" || Object.keys(input).some((key) => key !== "name" && key !== "tokens")) return Result.fail(new InvalidThemeError("la actualización contiene campos no permitidos"));
    const found = await findOwned(this.repository, ownerId, id);
    if (!found.isSuccess) return Result.fail(found.getError());
    const current = found.getValue();
    const data = current.toPersistence();
    const parsed = parseThemeTokensDto(input.tokens ?? toThemeDetails(current).tokens);
    if (!parsed.isSuccess) return Result.fail(parsed.getError());
    const updated = Theme.create({ ...data, name: input.name ?? data.name, tokens: parsed.getValue(), updatedAt: new Date() });
    if (!updated.isSuccess) return Result.fail(updated.getError());
    const saved = await this.repository.update(updated.getValue());
    return saved.isSuccess ? Result.ok(toThemeDetails(updated.getValue())) : Result.fail(saved.getError());
  }
}
