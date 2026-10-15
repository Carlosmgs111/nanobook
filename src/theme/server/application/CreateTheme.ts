import { randomUUID } from "node:crypto";
import { Result } from "../../../shared/domain/Result";
import { Theme } from "../domain/Theme";
import type { ThemeRepository } from "../domain/ports/ThemeRepository";
import { parseThemeTokensDto, toThemeDetails, type ThemeDetails, type ThemeTokensDto } from "./dto/ThemeDtos";

export class CreateTheme {
  constructor(private readonly repository: ThemeRepository, private readonly createId = randomUUID) {}
  async execute(ownerId: string, input: { name: string; baseThemeId: "classic" | "nanobook"; tokens?: ThemeTokensDto }): Promise<Result<Error, ThemeDetails>> {
    const tokens = parseThemeTokensDto(input.tokens ?? {});
    if (!tokens.isSuccess) return Result.fail(tokens.getError());
    const created = Theme.create({ id: this.createId(), ownerId, name: input.name, baseThemeId: input.baseThemeId, tokens: tokens.getValue() });
    if (!created.isSuccess) return Result.fail(created.getError());
    const saved = await this.repository.create(created.getValue());
    if (!saved.isSuccess) return Result.fail(saved.getError());
    return Result.ok(toThemeDetails(created.getValue()));
  }
}
