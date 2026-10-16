import { Result } from "../../../shared/domain/Result";
import type { OfficialThemeId } from "../infraestructure/OfficialThemeCatalog";
import { InvalidThemeError } from "./errors";
import { validateThemeTokens, type ThemeTokens } from "./ThemeTokens";

export interface ThemeData {
  id: string;
  ownerId: string;
  name: string;
  baseThemeId: OfficialThemeId;
  tokens: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Theme {
  private constructor(
    private readonly data: Omit<ThemeData, "tokens"> & {
      tokens: ThemeTokens;
      createdAt: Date;
      updatedAt: Date;
    }
  ) {}

  static create(data: ThemeData): Result<InvalidThemeError, Theme> {
    const id = data.id.trim();
    if (!id) return Result.fail(new InvalidThemeError("id es obligatorio"));
    const ownerId = data.ownerId.trim();
    if (!ownerId)
      return Result.fail(new InvalidThemeError("ownerId es obligatorio"));
    const name = data.name.trim();
    if (!name) return Result.fail(new InvalidThemeError("name es obligatorio"));
    if (name.length > 80)
      return Result.fail(
        new InvalidThemeError("name admite máximo 80 caracteres")
      );
    if (data.baseThemeId !== "classic" && data.baseThemeId !== "nanobook") {
      return Result.fail(new InvalidThemeError("baseThemeId es inválido"));
    }
    const tokens = validateThemeTokens(data.tokens);
    if (tokens instanceof InvalidThemeError) return Result.fail(tokens);
    const createdAt = data.createdAt ?? new Date();
    return Result.ok(
      new Theme({
        ...data,
        id,
        ownerId,
        name,
        tokens,
        createdAt,
        updatedAt: data.updatedAt ?? createdAt,
      })
    );
  }

  getId() {
    return this.data.id;
  }
  getOwnerId() {
    return this.data.ownerId;
  }
  getName() {
    return this.data.name;
  }
  getBaseThemeId() {
    return this.data.baseThemeId;
  }
  getTokens(): ThemeTokens {
    return structuredClone(this.data.tokens);
  }
  toPersistence() {
    return { ...this.data, tokens: this.getTokens() };
  }
}
