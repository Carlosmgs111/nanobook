import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { financialAuthoringGuide, financialGuideExamples } from "../guide/financialAuthoringGuide";
import { validateMarkdownBlocks } from "./validateMarkdownBlocks";

function fence(lang: string, body: string): string {
  return `\`\`\`${lang}\n${body}\n\`\`\``;
}

describe("validateMarkdownBlocks", () => {
  it("accepts every template in the authoring guide", () => {
    for (const [name, body] of Object.entries(financialGuideExamples)) {
      expect(validateMarkdownBlocks(fence(name, body)), name).toEqual([]);
    }
  });

  it("accepts the whole guide as a document, so its prose never drifts from the schemas", () => {
    expect(validateMarkdownBlocks(financialAuthoringGuide)).toEqual([]);
    for (const name of Object.keys(financialGuideExamples)) {
      expect(financialAuthoringGuide).toContain(`\`${name}\``);
    }
  });

  it("accepts the full demonstration note", () => {
    const note = readFileSync(new URL("../test/fixtures/alphabet-analysis.md", import.meta.url), "utf8");
    expect(validateMarkdownBlocks(note)).toEqual([]);
  });

  it("reports the line, block and field of an invalid financial block", () => {
    const body = financialGuideExamples["financial-chart"].replace("[80, null, 105]", "[80, 105]");
    const issues = validateMarkdownBlocks(`# Nota\n\ntexto\n\n${fence("financial-chart", body)}`);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ block: "financial-chart", line: 5 });
    expect(issues[0].path).toContain("series");
    expect(issues[0].message).toMatch(/valor por cada etiqueta/);
  });

  it("reports a unit mismatch with the percent convention intact", () => {
    const body = financialGuideExamples["financial-metrics"].replace("unit: percent", "unit: currency");
    const [issue] = validateMarkdownBlocks(fence("financial-metrics", body));

    expect(issue.block).toBe("financial-metrics");
    expect(issue.message).toMatch(/moneda/i);
  });

  it("rejects unsorted or repeated dates in a price chart, which would fail when mounting", () => {
    const unsorted = [
      "series:",
      "  type: line",
      "  data:",
      "    - { time: 2026-01-06, value: 1 }",
      "    - { time: 2026-01-05, value: 2 }",
    ].join("\n");
    const repeated = unsorted.replace("2026-01-05", "2026-01-06");

    for (const body of [unsorted, repeated]) {
      const [issue] = validateMarkdownBlocks(fence("price-chart", body));
      expect(issue).toMatchObject({ block: "price-chart", line: 1 });
      expect(issue.path).toBe("series.data");
      expect(issue.message).toMatch(/ascendente/);
    }
  });

  it("reports invalid YAML in a component block", () => {
    const [issue] = validateMarkdownBlocks(fence("price-chart", ": : ["));
    expect(issue).toMatchObject({ block: "price-chart" });
  });

  it("flags a misspelled block name, which would otherwise publish silently as code", () => {
    const [issue] = validateMarkdownBlocks(fence("financial-chartt", "chart: line"));

    expect(issue.block).toBe("financial-chartt");
    expect(issue.message).toContain("financial-chart");
    expect(issue.message).toContain("price-chart");
  });

  it("finds blocks nested in lists and quotes", () => {
    const nested = `- punto\n\n  ${fence("price-chart", ": : [").replaceAll("\n", "\n  ")}\n`;
    expect(validateMarkdownBlocks(nested)).toHaveLength(1);
  });

  it("ignores ordinary code fences and documents without blocks", () => {
    expect(validateMarkdownBlocks(fence("ts", "const a = 1;"))).toEqual([]);
    expect(validateMarkdownBlocks("# Solo texto")).toEqual([]);
    expect(validateMarkdownBlocks(fence("priceless", "x: 1"))).toEqual([]);
  });
});
