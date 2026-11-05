import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import type { FinancialChartBlock } from "../model/FinancialBlock";
import { createFinancialContentExtension } from "./createFinancialContentExtension";

const block: FinancialChartBlock = {
  kind: "financial-chart",
  version: 1,
  title: "Retorno <estimado>",
  description: "Retorno sobre capital.",
  chart: "line",
  x: ["2022", "2023", "2024", "2025"],
  series: [
    { name: "Empresa", unit: "percent", values: [-10, 0, null, 10], sourceIds: ["annual"] },
    { name: "Sector", unit: "percent", values: [0, 10, 0, 0], sourceIds: ["benchmark"] },
  ],
  sources: [
    { id: "annual", label: "Informe anual", url: "https://example.com/annual", type: "filing", period: { label: "2025" } },
    { id: "benchmark", label: "Datos sectoriales", url: "https://example.com/sector", type: "dataset", period: { label: "2025" } },
  ],
};

function fence(value: FinancialChartBlock): string {
  const { kind: _kind, version: _version, ...payload } = value;
  return `\`\`\`financial-chart\n${stringify(payload, { aliasDuplicateObjects: false })}\`\`\``;
}

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(() => createFinancialContentExtension().transform)
  .use(rehypeStringify)
  .freeze();

function render(...values: FinancialChartBlock[]): string {
  return String(processor.processSync(values.map(fence).join("\n\n")));
}

function plot(html: string): string {
  return html.match(/<svg[^>]* role="img"[^>]*>([\s\S]*?)<\/svg>/)?.[1] ?? "";
}

function markerShapes(svg: string): string[] {
  return [...svg.matchAll(/<path class="financial-chart__marker" d="M \S+ \S+ ([^"]+)"/g)]
    .map((match) => match[1]);
}

describe("renderFinancialChart", () => {
  it("serializes an accessible SVG with escaped text and unique IDs per chart", () => {
    const html = render(block, { ...block, description: undefined });

    expect(html).toContain('<figure class="financial-block financial-chart">');
    expect(html).toMatch(/<svg(?=[^>]* viewBox="0 0 800 360")(?=[^>]* role="img")(?=[^>]* aria-labelledby="financial:chart-0-title financial:chart-0-description")[^>]*>/);
    expect(html).toMatch(/<title id="financial:chart-0-title">Retorno (?:&#x3C;|&lt;)estimado>/);
    expect(html).toContain('<desc id="financial:chart-0-description">Retorno sobre capital.');
    expect(html).toContain('aria-labelledby="financial:chart-1-title financial:chart-1-description"');
    expect(html).toMatch(/<desc id="financial:chart-1-description">[^<]+<\/desc>/);
    expect(html).not.toContain("<estimado>");
  });

  it("breaks paths at missing points and shares the y scale across line series", () => {
    const svg = plot(render(block));
    const paths = [...svg.matchAll(/<path class="financial-chart__line" d="([^"]+)"/g)].map((match) => match[1]);

    expect(paths).toEqual([
      expect.stringMatching(/^M 72 304 L \S+ 164$/),
      expect.stringMatching(/^M 72 164 L \S+ 24 L \S+ 164 L 776 164$/),
    ]);
    expect(svg).toContain('<path class="financial-chart__marker" d="M 776 24 ');
    expect(svg).toContain('stroke-dasharray="8 4"');
  });

  it("preserves the connected path across 120 points without point markers", () => {
    const values = Array.from({ length: 120 }, (_, index) => index);
    const svg = plot(render({
      ...block,
      x: values.map(String),
      series: [{ ...block.series[0], values }],
    }));
    const path = svg.match(/<path class="financial-chart__line" d="([^"]+)"/)?.[1] ?? "";

    expect(path.split(" L ")).toHaveLength(120);
    expect(markerShapes(svg)).toHaveLength(0);
  });

  it("uses the same distinct marker for each isolated point and its legend entry", () => {
    const html = render({
      ...block,
      series: Array.from({ length: 8 }, (_, index) => ({
        ...block.series[0], name: `Serie ${index + 1}`, values: [index, index + 1, null, index + 2],
      })),
    });
    const seriesMarkers = markerShapes(plot(html));
    const legendMarkers = markerShapes(html.slice(html.indexOf('<ol class="financial-chart__legend">')));

    expect(new Set(legendMarkers).size).toBe(8);
    expect(seriesMarkers).toEqual(legendMarkers);
  });

  it("omits missing bars, groups series by category and uses the same zero line", () => {
    const svg = plot(render({ ...block, chart: "bar" }));
    const bars = [...svg.matchAll(/<rect[^>]* x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)]
      .map((match) => match.slice(1).map(Number));

    expect(bars).toEqual([
      [95, 164, 64, 140], [623, 24, 64, 140], [337, 24, 64, 140],
    ]);
    const zeroMarkers = [...svg.matchAll(/<line class="financial-chart__zero" x1="([^"]+)" x2="([^"]+)" y1="([^"]+)" y2="([^"]+)" stroke-width="([^"]+)"/g)]
      .map((match) => match.slice(1).map(Number));
    expect(zeroMarkers).toEqual([
      [271, 335, 164, 164, 3], [161, 225, 164, 164, 3],
      [513, 577, 164, 164, 3], [689, 753, 164, 164, 3],
    ]);
  });

  it("keeps rendered bar strokes separated at eight series by 120 categories", () => {
    const x = Array.from({ length: 120 }, (_, index) => String(index + 1));
    const svg = plot(render({
      ...block, chart: "bar", x,
      series: Array.from({ length: 8 }, (_, index) => ({
        ...block.series[0], name: `Serie ${index + 1}`, values: x.map(() => 1),
      })),
    }));
    const extents = [...svg.matchAll(/<rect\b[^>]*>/g)].map(([rect]) => {
      const start = Number(rect.match(/\bx="([^"]+)"/)?.[1]);
      const width = Number(rect.match(/\bwidth="([^"]+)"/)?.[1]);
      const stroke = Number(rect.match(/\bstroke-width="([^"]+)"/)?.[1] ?? 1);
      expect(width).toBeGreaterThan(0);
      return { left: start - stroke / 2, right: start + width + stroke / 2 };
    }).sort((a, b) => a.left - b.left);

    expect(extents).toHaveLength(960);
    extents.slice(1).forEach(({ left }, index) => {
      expect(left).toBeGreaterThan(extents[index].right);
    });
  });

  it("includes zero in the scale of a positive-only bar chart", () => {
    const html = render({ ...block, chart: "bar", series: [
      { ...block.series[0], values: [2, 4, null, 8] },
    ] });

    expect(html).toContain('x="95" y="234" width="130" height="70"');
    expect(html).toContain('x="623" y="24" width="130" height="280"');
  });

  it.each([
    { values: [0.001, 0.002], unit: "currency", currency: "COP", labels: ["COP 0,001", "COP 0,002"] },
    { values: [120_000_000, 240_000_000], unit: "currency", currency: "COP", labels: ["COP 1,2e+8", "COP 2,4e+8"] },
    { values: [120_000_000, 240_000_000], unit: "percent", currency: undefined, labels: ["1,2e+8 %", "2,4e+8 %"] },
    { values: [120_000_000, 240_000_000], unit: "multiple", currency: undefined, labels: ["1,2e+8×", "2,4e+8×"] },
    { values: [120_000_000, 120_000_001], unit: "currency", currency: "COP", labels: ["COP 1,2e+8", "COP 1,20000001e+8"] },
    { values: [0.00001, 0.00002], unit: "currency", currency: "COP", labels: ["COP 1,0e-5", "COP 2,0e-5"] },
  ] as const)("keeps distinct $unit axis labels for $values", ({ values, unit, currency, labels }) => {
    const svg = plot(render({
      ...block, x: ["2024", "2025"],
      series: [{ ...block.series[0], unit, currency, values: [...values] }],
    }));

    const ticks = [...svg.matchAll(/<text [^>]* y="(?:308|28)"[^>]*>([^<]+)<\/text>/g)].map((match) => match[1]);
    expect(ticks).toEqual(labels);
  });

  it("shows available citation periods and dates next to their safe links", () => {
    const html = render({
      ...block,
      sources: [
        { ...block.sources[0], period: { label: "Ejercicio 2025", from: "2025-01-01", to: "2025-12-31" }, accessedAt: "2026-03-12" },
        { ...block.sources[1], period: undefined, publishedAt: "2026-02-09" },
        { ...block.sources[0], id: "unused", label: "Informe sin citar", accessedAt: "2026-01-06" },
      ],
    });
    const legend = html.match(/<ol class="financial-chart__legend">([\s\S]*?)<\/ol>/)?.[1] ?? "";
    const [first, second] = [...legend.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);

    expect(first).toContain('>Informe anual</a>');
    expect(first).toContain("Ejercicio 2025");
    expect(first).toContain('<time datetime="2025-01-01">1 ene 2025</time>');
    expect(first).toContain('<time datetime="2025-12-31">31 dic 2025</time>');
    expect(first).toContain('<time datetime="2026-03-12">12 mar 2026</time>');
    expect(second).toContain('>Datos sectoriales</a>');
    expect(second).toContain('<time datetime="2026-02-09">9 feb 2026</time>');
    expect(legend).not.toContain("Informe sin citar");
    expect(legend).not.toContain("2026-01-06");
  });

  it.each(["line", "bar"] as const)("renders a textual legend, per-series citations and the complete %s table", (chart) => {
    const html = render({ ...block, chart });
    const legend = html.match(/<ol class="financial-chart__legend">([\s\S]*?)<\/ol>/)?.[1] ?? "";
    const items = [...legend.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);

    expect(items).toHaveLength(2);
    expect(items[0]).toContain("Empresa");
    expect(items[0]).toContain('<a href="https://example.com/annual" target="_blank" rel="noopener noreferrer external">Informe anual</a>');
    expect(items[0]).not.toContain("Datos sectoriales");
    expect(items[1]).toContain("Sector");
    expect(items[1]).toContain('<a href="https://example.com/sector" target="_blank" rel="noopener noreferrer external">Datos sectoriales</a>');
    expect(items[1]).not.toContain("Informe anual");
    expect(items[1]).toContain('stroke-dasharray="8 4"');
    expect(html).toMatch(/<details[^>]*><summary>Ver datos del gráfico<\/summary>/);
    expect(html).toContain('<table aria-labelledby="financial:chart-0-heading">');
    expect(html).toContain('<th scope="col">Empresa</th><th scope="col">Sector</th>');
    expect(html).toContain('<tr><th scope="row">2022</th><td>−10,0 %</td><td>0,0 %</td></tr>');
    expect(html).toContain('<tr><th scope="row">2023</th><td>0,0 %</td><td>10,0 %</td></tr>');
    expect(html).toContain('<tr><th scope="row">2024</th><td>Sin dato</td><td>0,0 %</td></tr>');
    expect(html).toContain('<tr><th scope="row">2025</th><td>10,0 %</td><td>0,0 %</td></tr>');
  });

  it("makes the table separately scrollable by keyboard inside the disclosure", () => {
    const details = render(block).match(/<details[^>]*>([\s\S]*?)<\/details>/)?.[1];
    const tableRegion = details?.match(/<\/summary><div([^>]*)><table[\s\S]*?<\/table><\/div>/)?.[1] ?? "";

    expect(tableRegion).toContain('class="financial-chart__table"');
    expect(tableRegion).toContain('tabindex="0"');
    expect(tableRegion).toContain('role="region"');
    expect(tableRegion).toContain('aria-label="Datos del gráfico"');
  });
});
