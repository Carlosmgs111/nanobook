import { ResolveTheme } from "./application/ResolveTheme";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { OfficialThemeCatalog } from "./infraestructure/OfficialThemeCatalog";
import { DrizzleThemeRepository } from "./infraestructure/repository/DrizzleThemeRepository";

export type { AppliedTheme, ThemeReference } from "./application/ResolveTheme";

export class ThemeModule {
  private constructor(public readonly resolveTheme: ResolveTheme) {}

  static create(): ThemeModule {
    const repository = new DrizzleThemeRepository(db);
    return new ThemeModule(new ResolveTheme(new OfficialThemeCatalog(), repository));
  }
}
