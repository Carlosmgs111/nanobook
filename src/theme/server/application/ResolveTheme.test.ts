import { describe, expect, it } from "vitest";

import { OfficialThemeCatalog } from "../infraestructure/OfficialThemeCatalog";
import { ResolveTheme } from "./ResolveTheme";

describe("ResolveTheme", () => {
  it("resolves the complete classic theme", async () => {
    const result = await new ResolveTheme(new OfficialThemeCatalog()).execute({
      kind: "official",
      id: "classic",
    });

    expect(result).toMatchObject({
      key: "official:classic",
      baseId: "classic",
    });
    expect(result.darkVariables["--theme-dark-page-bg"]).toBe("#050505");
    expect(Object.keys(result.lightVariables)).toEqual(
      Object.keys(result.darkVariables).map((key) => key.replace("--theme-dark-", "--theme-light-")),
    );
  });

  it("falls back to classic for an unknown official id", async () => {
    const result = await new ResolveTheme(new OfficialThemeCatalog()).execute({
      kind: "official",
      id: "missing",
    });

    expect(result.key).toBe("official:classic");
    expect(result.baseId).toBe("classic");
  });
});
