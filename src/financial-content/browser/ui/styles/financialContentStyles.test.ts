import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylePath = "src/financial-content/browser/ui/styles/financial-content.css";
const globalStylePath = "src/shared/styles/global.css";
const themeContractPath = "src/theme/browser/ui/styles/contract.css";
function stylesheet(): string {
  expect(existsSync(stylePath), "the module stylesheet exists").toBe(true);
  return readFileSync(stylePath, "utf8");
}

describe("financial content styles", () => {
  it("loads the module stylesheet once from the shared global stylesheet", () => {
    const global = readFileSync(globalStylePath, "utf8");
    expect([...global.matchAll(/@import\s+["'][^"']*\/financial-content\.css["']/g)]).toHaveLength(1);
  });

  it("styles all block kinds and the fallback with shared semantic roles", () => {
    const css = stylesheet();
    for (const className of [
      "financial-block", "financial-company", "financial-metrics", "financial-chart",
      "financial-news", "financial-sources", "financial-block--error",
    ]) {
      expect(css).toMatch(new RegExp(`\\.${className}(?![\\w-])`));
    }
    for (const role of [
      "surface-bg", "content-primary", "content-muted", "border", "panel-radius",
      "status-success", "status-warning", "status-error",
    ]) {
      expect(css).toContain(`var(--theme-${role})`);
    }
  });

  it("uses only shared, mode-independent theme variables and no private palette", () => {
    const css = stylesheet();
    const contract = readFileSync(themeContractPath, "utf8");
    const contractVariables = new Set([...contract.matchAll(/^\s*(--theme-[\w-]+):/gm)].map((match) => match[1]));
    for (const [, variable] of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
      expect(contractVariables.has(variable), variable).toBe(true);
    }
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|\brgba?\s*\(|(?:^|[\s{;])--[\w-]+\s*:/im);
    expect(css).not.toMatch(/\.(?:bg|text|border|fill|stroke)-(?:[a-z]+-\d+|black|white)\b/i);
    expect(css).not.toMatch(/\bcompanio\b|\bdata-color-mode\b|\b--theme-(?:light|dark)-/i);
  });

  it("keeps charts responsive, tables scrollable and keyboard focus visible", () => {
    const css = stylesheet();
    expect(css).toMatch(/\.financial-chart__plot\b[^{}]*\{[^}]*width:\s*100%[^}]*height:\s*auto/);
    expect(css).toMatch(/\.financial-chart__table\b[^{}]*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/:focus-visible[^{}]*\{[^}]*outline:[^}]*var\(--theme-focus-ring\)/);
    expect(css).toMatch(/@media\s*\(max-width:/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it("switches to readable HTML axis references when the chart itself is narrow", () => {
    const css = stylesheet();
    const chartContainer = css.match(/@container\s+financial-chart\s+\(max-width:\s*36rem\)\s*\{([\s\S]*?)^\}/m)?.[1] ?? "";
    const viewportRules = [...css.matchAll(/@media[^{]*\{([\s\S]*?)^\}/gm)].map((match) => match[1]).join("\n");

    expect(css).toMatch(/\.financial-chart\s*\{[^}]*container-type:\s*inline-size[^}]*container-name:\s*financial-chart/);
    expect(css).toMatch(/\.financial-chart__axis-summary\s*\{[^}]*display:\s*none/);
    expect(chartContainer).toMatch(/\.financial-chart__axis-summary\s*\{[^}]*display:\s*grid/);
    expect(chartContainer).toMatch(/\.financial-chart__axes text\s*\{[^}]*display:\s*none/);
    expect(viewportRules).not.toMatch(/\.financial-chart__(?:axis-summary|axes)/);
    expect(css).not.toMatch(/\.financial-chart__plot\b[^{}]*\{[^}]*overflow/);
  });

  it.each(["favorable", "unfavorable", "neutral"])("shows a visible %s comparison indicator", (direction) => {
    expect(stylesheet()).toMatch(new RegExp(`\\[data-direction="${direction}"\\]::before[^{}]*\\{[^}]*content:\\s*".+?"`));
  });
});
