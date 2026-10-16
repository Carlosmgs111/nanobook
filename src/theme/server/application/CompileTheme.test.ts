import { describe, expect, it } from "vitest";
import { CompileTheme } from "./CompileTheme";

describe("CompileTheme", () => {
  it("installs both palettes in one deterministic stylesheet", () => {
    const installation = new CompileTheme().execute({
      key: "custom:theme-1",
      baseId: "classic",
      lightVariables: {
        "--theme-light-accent": "#111111",
        "--theme-light-page-bg": "#ffffff",
      },
      darkVariables: {
        "--theme-dark-accent": "#eeeeee",
        "--theme-dark-page-bg": "#000000",
      },
    });

    expect(installation.cssText).toBe(
      ":root[data-theme-key]{--theme-dark-accent:#eeeeee;--theme-dark-page-bg:#000000;--theme-light-accent:#111111;--theme-light-page-bg:#ffffff;}",
    );
    expect(installation.cssText).not.toContain("style=");
    expect(installation.variables["--theme-light-accent"]).toBe("#111111");
  });
});
