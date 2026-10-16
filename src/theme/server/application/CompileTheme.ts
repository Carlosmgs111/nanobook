import { serializeThemeCss, type ThemeCssVariables } from "../../shared/ThemeCss";
import type { AppliedTheme } from "./ResolveTheme";

export interface ThemeInstallation {
  key: string;
  baseId: AppliedTheme["baseId"];
  variables: ThemeCssVariables;
  cssText: string;
}

export class CompileTheme {
  execute(theme: AppliedTheme): ThemeInstallation {
    const variables = {
      ...theme.lightVariables,
      ...theme.darkVariables,
    };

    return {
      key: theme.key,
      baseId: theme.baseId,
      variables,
      cssText: serializeThemeCss(variables),
    };
  }
}
