import {
  OfficialThemeCatalog,
  type OfficialThemeId,
} from "../infraestructure/OfficialThemeCatalog";

export type ThemeReference = { kind: "official"; id: string };

export interface AppliedTheme {
  key: string;
  baseId: OfficialThemeId;
  lightVariables: Readonly<Record<`--theme-light-${string}`, string>>;
  darkVariables: Readonly<Record<`--theme-dark-${string}`, string>>;
}

export class ResolveTheme {
  constructor(private readonly catalog: OfficialThemeCatalog) {}

  async execute(reference: ThemeReference): Promise<AppliedTheme> {
    const definition = this.catalog.get(reference.id);
    return {
      key: `official:${definition.id}`,
      baseId: definition.id,
      lightVariables: prefix(definition.light, "light"),
      darkVariables: prefix(definition.dark, "dark"),
    };
  }
}

function prefix(
  values: Readonly<Record<string, string>>,
  mode: "light" | "dark",
): Record<`--theme-${typeof mode}-${string}`, string> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [`--theme-${mode}-${name}`, value]),
  ) as Record<`--theme-${typeof mode}-${string}`, string>;
}
