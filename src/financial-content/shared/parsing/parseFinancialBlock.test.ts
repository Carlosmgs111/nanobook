import { describe, expect, it } from "vitest";
import { stringify as stringifyYaml } from "yaml";
import { isFinancialFenceKind, parseFinancialBlock } from "../index";
import type { FinancialFenceKind } from "../index";

function stringify(value: unknown): string {
  return stringifyYaml(value, { aliasDuplicateObjects: false });
}

const source = {
  id: "annual-report",
  label: "Annual report",
  url: "https://example.com/annual-report",
  type: "filing",
  period: { label: "FY 2025" },
};

const series = {
  name: "ROCE",
  unit: "percent",
  values: [16.7],
  sourceIds: [source.id],
};

const metric = {
  label: "ROCE",
  value: 16.7,
  unit: "percent",
  period: { label: "FY 2025" },
  sourceIds: [source.id],
};

const newsItem = {
  title: "Quarterly results",
  summary: "Revenue grew in the latest quarter.",
  sourceId: "results",
};

const newsSource = {
  id: "results",
  label: "Quarterly results",
  url: "https://example.com/results",
  type: "news",
  publishedAt: "2024-02-29",
};

const validCases: Array<{ kind: FinancialFenceKind; yaml: string }> = [
  {
    kind: "company-profile",
    yaml: stringify({
      company: {
        name: "Alphabet Inc.",
        ticker: "GOOG",
        exchange: "NASDAQ",
        country: "United States",
        industry: "Technology",
        description: "Technology company.",
        reportingCurrency: "USD",
        asOf: "2025-12-31",
        sourceIds: [source.id],
      },
      sources: [source],
    }),
  },
  {
    kind: "financial-chart",
    yaml: stringify({
      title: "  Annual ROCE  ",
      chart: "line",
      x: ["2025"],
      series: [series],
      sources: [source],
    }),
  },
  {
    kind: "financial-metrics",
    yaml: stringify({ metrics: [metric], sources: [source] }),
  },
  {
    kind: "financial-news",
    yaml: stringify({ items: [newsItem], sources: [newsSource] }),
  },
  {
    kind: "financial-sources",
    yaml: stringify({ items: [source] }),
  },
];

function expectError(
  kind: FinancialFenceKind,
  yaml: string,
  code: string,
  path: Array<string | number>,
) {
  const result = parseFinancialBlock(kind, yaml);
  expect(result.isSuccess).toBe(false);
  const error = result.getError();
  expect(error).toMatchObject({ kind, code, path, message: expect.any(String) });
  return error;
}

describe("parseFinancialBlock", () => {
  it.each(validCases)("parses $kind as version 1", ({ kind, yaml }) => {
    expect(isFinancialFenceKind(kind)).toBe(true);
    const result = parseFinancialBlock(kind, yaml);
    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toMatchObject({ kind, version: 1 });
  });

  it("recognizes only the financial fence names", () => {
    expect(isFinancialFenceKind("toString")).toBe(false);
    expect(isFinancialFenceKind("financial-chart-extra")).toBe(false);
  });

  it("trims text and accepts explicit version 1", () => {
    const { kind, yaml } = validCases[1];
    const result = parseFinancialBlock(kind, `version: 1\n${yaml}`);
    expect(result.getValue()).toMatchObject({
      kind: "financial-chart",
      version: 1,
      title: "Annual ROCE",
      x: ["2025"],
    });
  });

  it.each(["2", "null", '"1"'])("rejects explicit version %s", (version) => {
    const { kind, yaml } = validCases[4];
    expectError(kind, `version: ${version}\n${yaml}`, "unsupported-version", ["version"]);
  });

  it("rejects duplicate source ids", () => {
    const yaml = stringify({ items: [source, { ...source, label: "Duplicate" }] });
    expectError("financial-sources", yaml, "duplicate-source-id", ["items", 1, "id"]);
  });

  it("rejects missing source references", () => {
    const yaml = stringify({
      metrics: [{ ...metric, sourceIds: ["other-filing"] }],
      sources: [source],
    });
    expectError("financial-metrics", yaml, "missing-source-reference", ["metrics", 0, "sourceIds", 0]);
  });

  it("rejects duplicate source references in a citation list", () => {
    const yaml = stringify({
      metrics: [{ ...metric, sourceIds: [source.id, source.id] }],
      sources: [source],
    });
    expectError("financial-metrics", yaml, "duplicate-source-reference", ["metrics", 0, "sourceIds", 1]);
  });

  it("requires news references to point to news sources", () => {
    const yaml = stringify({ items: [newsItem], sources: [{ ...newsSource, type: "filing" }] });
    expectError("financial-news", yaml, "invalid-source-type", ["items", 0, "sourceId"]);
  });

  it("requires each source to have a publication date or period", () => {
    const yaml = stringify({ items: [{ ...source, period: undefined }] });
    expectError("financial-sources", yaml, "missing-source-date", ["items", 0]);
  });

  it.each([
    "http://example.com", "javascript:alert(1)", "data:text/html,x",
    "/report", "//example.com/report", "https:example.com",
  ])("rejects unsafe source url %s", (url) => {
    const yaml = stringify({ items: [{ ...source, url }] });
    expectError("financial-sources", yaml, "invalid-url", ["items", 0, "url"]);
  });

  it.each([
    { variant: "a tab before an extra slash", url: "https://\t/example.com" },
    { variant: "a newline in the host", url: "https://e\nxample.com" },
    { variant: "a backslash after the host", url: "https://example.com\\report" },
  ])("rejects a malformed HTTPS source URL with $variant", ({ url }) => {
    const yaml = stringify({ items: [{ ...source, url }] });
    expectError("financial-sources", yaml, "invalid-url", ["items", 0, "url"]);
  });

  it("preserves an absolute HTTPS URL with an encoded path", () => {
    const url = "https://example.com/reports/annual%20report?year=2025#results";
    const yaml = stringify({ items: [{ ...source, url }] });
    const result = parseFinancialBlock("financial-sources", yaml);
    expect(result.getValue()).toMatchObject({ items: [{ url }] });
  });

  it("rejects unknown payload fields", () => {
    const { kind, yaml } = validCases[4];
    const error = expectError(kind, `private-test-marker: rejected-value\n${yaml}`, "unknown-field", []);
    expect(JSON.stringify(error)).not.toContain("private-test-marker");
    expect(JSON.stringify(error)).not.toContain("rejected-value");
    expect(error.message).not.toContain("rejected-value");
    expectError(kind, `kind: financial-sources\n${yaml}`, "unknown-field", []);
  });

  it("rejects unknown nested payload fields", () => {
    const yaml = stringify({
      metrics: [{
        ...metric,
        comparison: { label: "FY 2024", value: 3, direction: "neutral", unit: "number" },
      }],
      sources: [source],
    });
    expectError("financial-metrics", yaml, "unknown-field", ["metrics", 0, "comparison"]);
  });

  it("rejects prototype keys inside nested objects", () => {
    const { kind, yaml } = validCases[4];
    expectError(kind, yaml.replace("- id:", "- __proto__: {}\n    id:"), "unknown-field", []);
  });

  it("rejects non-finite values and invalid ISO dates", () => {
    const metricYaml = stringify({ metrics: [{ ...metric, value: Infinity }], sources: [source] });
    expectError("financial-metrics", metricYaml, "invalid-number", ["metrics", 0, "value"]);

    for (const publishedAt of ["2025-02-29", "2024-04-31", "2024-01-01T00:00:00Z"]) {
      const yaml = stringify({ items: [{ ...newsSource, publishedAt }] });
      expectError("financial-sources", yaml, "invalid-date", ["items", 0, "publishedAt"]);
    }
  });

  it.each<{ kind: FinancialFenceKind; yaml: string; path: Array<string | number> }>([
    {
      kind: "company-profile",
      yaml: validCases[0].yaml.replace("asOf: 2025-12-31", "asOf: 0000-01-01"),
      path: ["company", "asOf"],
    },
    {
      kind: "financial-sources",
      yaml: stringify({ items: [{ ...newsSource, publishedAt: "0000-01-01" }] }),
      path: ["items", 0, "publishedAt"],
    },
  ])("rejects year zero in $kind dates", ({ kind, yaml, path }) => {
    expectError(kind, yaml, "invalid-date", path);
  });

  it("enforces collection limits from the v1 contract", () => {
    const sources = Array.from({ length: 31 }, (_, i) => ({ ...source, id: `source-${i}` }));
    const chart = { title: "ROCE", chart: "line", x: ["2025"], sources: [source] };
    const metrics = Array.from({ length: 13 }, () => ({ ...metric }));
    const items = Array.from({ length: 13 }, () => ({ ...newsItem }));
    const points = Array.from({ length: 121 }, (_, i) => i);

    expectError("financial-sources", stringify({ items: sources }), "collection-limit", ["items"]);
    expectError("financial-metrics", stringify({ metrics, sources: [source] }), "collection-limit", ["metrics"]);
    expectError("financial-news", stringify({ items, sources: [newsSource] }), "collection-limit", ["items"]);
    expectError("financial-chart", stringify({
      ...chart, series: Array.from({ length: 9 }, () => ({ ...series, values: [1], sourceIds: [source.id] })),
    }), "collection-limit", ["series"]);
    expectError("financial-chart", stringify({
      ...chart, x: points.map(String), series: [{ ...series, values: points }],
    }), "collection-limit", ["x"]);
  });

  it("rejects yaml aliases and custom tags", () => {
    const { kind, yaml } = validCases[4];
    expectError(kind, `title: &label Sources\ndescription: *label\n${yaml}`, "yaml-alias", []);
    expectError(kind, `title: !custom Sources\n${yaml}`, "yaml-tag", []);
    expectError(kind, `title: !!timestamp 2025-12-31\n${yaml}`, "yaml-tag", []);
    expectError(kind, yaml.replace("items:", "!custom items:"), "yaml-tag", []);
  });

  it("rejects malformed YAML without exposing its contents", () => {
    const error = expectError("financial-sources", "items: [private-test-marker", "invalid-yaml", []);
    expect(error.message).not.toContain("private-test-marker");
    expect(JSON.stringify(error)).not.toContain("private-test-marker");
  });
});
