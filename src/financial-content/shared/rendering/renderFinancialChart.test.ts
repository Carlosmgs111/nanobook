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
  return `\`\`\`financial-chart\n${stringify(payload)}\`\`\``;
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
    const html = render(block);
    const svg = html.match(/<svg[^>]* role="img"[^>]*>([\s\S]*?)<\/svg>/)?.[1] ?? "";
    const paths = [...svg.matchAll(/<path[^>]* d="([^"]+)"/g)].map((match) => match[1]);

    expect(paths).toHaveLength(3);
    expect(paths[0]).toMatch(/^M 72 304 L \S+ 164$/);
    expect(paths[1]).toMatch(/^M 776 24\b/);
    expect(paths[2]).toMatch(/^M 72 164 L \S+ 24 L \S+ 164 L 776 164$/);
    expect(svg).toContain('stroke-dasharray="8 4"');
  });

  it("omits missing bars, groups series by category and uses the same zero line", () => {
    const html = render({ ...block, chart: "bar" });
    const svg = html.match(/<svg[^>]* role="img"[^>]*>([\s\S]*?)<\/svg>/)?.[1] ?? "";
    const bars = [...svg.matchAll(/<rect[^>]* x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)]
      .map((match) => match.slice(1).map(Number));

    expect(bars).toEqual([
      [94, 164, 66, 140], [270, 164, 66, 0], [622, 24, 66, 140],
      [160, 164, 66, 0], [336, 24, 66, 140], [512, 164, 66, 0], [688, 164, 66, 0],
    ]);
  });

  it("includes zero in the scale of a positive-only bar chart", () => {
    const html = render({ ...block, chart: "bar", series: [
      { ...block.series[0], values: [2, 4, null, 8] },
    ] });

    expect(html).toContain('x="94" y="234" width="132" height="70"');
    expect(html).toContain('x="622" y="24" width="132" height="280"');
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
});
