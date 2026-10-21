import { describe, expect, it } from "vitest";
import { cornerImage, coverValues, densityValues, hatchImage, pagePatternImage, shadowValue } from "./ThemePresets";

describe("theme identity presets", () => {
  it("keeps book covers asymmetric and adds a spine", () => {
    expect(coverValues("book")).toEqual({ radius: "3px 9px 9px 3px", spine: "12px" });
    expect(coverValues("square")).toEqual({ radius: "0px", spine: "0px" });
  });

  it("distinguishes plus crosses from straight corner brackets", () => {
    expect(cornerImage("cross")).toContain("left 0 top 6px / 14px 2px no-repeat");
    expect(cornerImage("line")).toContain("left 7px top 7px / 10px 1px no-repeat");
    expect(cornerImage("none")).toBe("none");
  });

  it("maps pattern and elevation choices to safe CSS values", () => {
    expect(hatchImage("texture")).toContain("var(--theme-decoration-hatch-subtle)");
    expect(hatchImage("hatch")).toBe(hatchImage("texture"));
    expect(hatchImage("stripes")).toContain("repeating-linear-gradient(135deg, var(--theme-decoration-hatch-subtle) 0 1px, transparent 1px 10px)");
    expect(hatchImage("none")).toBe("none");
    expect(pagePatternImage("texture")).toContain("var(--theme-decoration-hatch-subtle)");
    expect(pagePatternImage("stripes")).toContain("2px 12px");
    expect(shadowValue("offset")).toContain("12px 12px 0");
    expect(shadowValue("flat")).toBe("none");
  });

  it("keeps content gaps and increases the whole spacing scale with density", () => {
    const compact = densityValues("compact");
    const comfortable = densityValues("comfortable");
    const relaxed = densityValues("relaxed");
    expect([compact.contentGap, comfortable.contentGap, relaxed.contentGap]).toEqual(["1rem", "1.5rem", "2rem"]);
    for (const key of ["inline", "block", "section"] as const) {
      expect(parseFloat(compact[key])).toBeLessThan(parseFloat(comfortable[key]));
      expect(parseFloat(comfortable[key])).toBeLessThan(parseFloat(relaxed[key]));
    }
  });
});
