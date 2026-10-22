import { describe, expect, it } from "vitest";
import { cornerImage, coverValues, densityValues, patternImage, patternStep, patternContrast, shadowValue } from "./ThemePresets";

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
    expect(patternImage("texture")).toContain("var(--theme-decoration-pattern-color)");
    expect(patternImage("texture")).toContain("var(--theme-decoration-pattern-step)");
    expect(patternImage("grid")).toContain("linear-gradient(");
    expect(patternImage("none")).toBe("none");
    expect(patternStep("fine")).toBe("12px");
    expect(patternStep("regular")).toBe("20px");
    expect(patternStep("coarse")).toBe("32px");
    expect(patternContrast("subtle")).toBe("4%");
    expect(patternContrast("balanced")).toBe("8%");
    expect(patternContrast("strong")).toBe("14%");
    expect(patternImage("stripes")).toContain("repeating-linear-gradient(135deg, var(--theme-decoration-pattern-color)");
    expect(patternImage("hatch")).toBe(patternImage("texture"));
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
