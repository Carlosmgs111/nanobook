import { ResolveTheme } from "./application/ResolveTheme";
import { OfficialThemeCatalog } from "./infraestructure/OfficialThemeCatalog";

export type { AppliedTheme, ThemeReference } from "./application/ResolveTheme";

export class ThemeModule {
  private constructor(public readonly resolveTheme: ResolveTheme) {}

  static create(): ThemeModule {
    return new ThemeModule(new ResolveTheme(new OfficialThemeCatalog()));
  }
}
