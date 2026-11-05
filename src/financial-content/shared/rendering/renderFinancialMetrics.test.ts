import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { renderMarkdown } from "../../../rendering/shared/renderMarkdown";
import type { FinancialMetricsBlock } from "../model/FinancialBlock";
import { createFinancialContentExtension } from "./createFinancialContentExtension";
import { renderFinancialMetrics } from "./renderFinancialMetrics";

const sources = [
  { id: "annual", label: "Informe anual", url: "https://example.com/annual", type: "filing" as const, period: { label: "2025" } },
  { id: "results", label: "Resultados", url: "https://example.com/results", type: "earnings" as const, publishedAt: "2026-02-10" },
  { id: "unused", label: "Fuente sin citar", url: "https://example.com/unused", type: "dataset" as const, period: { label: "2024" } },
];

const block: FinancialMetricsBlock = {
  kind: "financial-metrics",
  version: 1,
  title: "Indicadores",
  description: "Resultados clave.",
  sources,
  metrics: [
    {
      label: "Ingresos",
      value: 1234.5,
      unit: "currency",
      currency: "COP",
      period: { label: "Año fiscal 2025" },
      description: "Ventas consolidadas.",
      comparison: { label: "Frente a 2024", value: 10.25, direction: "favorable" },
      sourceIds: ["annual"],
    },
    {
      label: "EV/EBITDA",
      value: 8.2,
      unit: "multiple",
      period: { label: "Primer trimestre de 2026" },
      comparison: { label: "Frente al sector", value: -2, direction: "unfavorable" },
      sourceIds: ["results"],
    },
    {
      label: "Margen",
      value: 0,
      unit: "percent",
      period: { label: "2025" },
      comparison: { label: "Frente a 2024", value: 0, direction: "neutral" },
      sourceIds: ["annual"],
    },
  ],
};

async function render(value: FinancialMetricsBlock = block): Promise<string> {
  const { kind: _kind, version: _version, ...payload } = value;
  return renderMarkdown(`\`\`\`financial-metrics\n${stringify(payload)}\`\`\``, [createFinancialContentExtension()]);
}

describe("renderFinancialMetrics", () => {
  // The first render initializes Shiki in this test worker.
  it("renders semantic values, periods, descriptions, comparisons and per-metric citations", async () => {
    const html = await render();

    expect(html).toContain('<section class="financial-block financial-metrics" aria-labelledby="financial:metrics-0-heading">');
    expect(html).toContain('<h2 id="financial:metrics-0-heading">Indicadores</h2>');
    expect(html).toContain("<dl");
    expect(html).toContain("<dt>Ingresos</dt>");
    expect(html).toContain("COP 1.234,50");
    expect(html).toContain("8,2×");
    expect(html).toContain("Año fiscal 2025");
    expect(html).toContain("Primer trimestre de 2026");
    expect(html).toContain('aria-describedby="financial:metrics-0-metric-0-description"');
    expect(html).toContain('<p id="financial:metrics-0-metric-0-description">Ventas consolidadas.</p>');
    expect(html.match(/Ventas consolidadas\./g)).toHaveLength(1);
    expect(html).toContain('data-direction="favorable"');
    expect(html).toContain('data-direction="unfavorable"');
    expect(html).toContain('data-direction="neutral"');
    expect(html).toContain("Favorable");
    expect(html).toContain("Desfavorable");
    expect(html).toContain("Neutral");
    expect(html).toContain("Frente a 2024");
    expect(html).toContain("10,25");
    expect(html).not.toContain("Fuente sin citar");
    expect(html).not.toContain("https://example.com/unused");
    const metricGroups = [...html.matchAll(/<div class="financial-metrics__item">([\s\S]*?)<\/div>/g)].map((match) => match[1]);
    expect(metricGroups).toHaveLength(3);
    expect(metricGroups[0]).toContain("Informe anual");
    expect(metricGroups[0]).not.toContain("Resultados</a>");
    expect(metricGroups[1]).toContain("Resultados</a>");
    expect(metricGroups[1]).not.toContain("Informe anual");
  }, 15_000);

  it("keeps metric IDs distinct across repeated blocks and escapes user text", async () => {
    const escaped = { ...block, title: "<script>bad</script>" };
    const { kind: _kind, version: _version, ...payload } = escaped;
    const source = `\`\`\`financial-metrics\n${stringify(payload)}\`\`\``;
    const html = await renderMarkdown(`${source}\n\n${source}`, [createFinancialContentExtension()]);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

    expect(new Set(ids).size).toBe(ids.length);
    expect(html).toContain('financial:metrics-1-metric-0-description');
    expect(html).not.toContain("<script>");
  });

  it("uses an internal fallback for an unexpectedly missing citation", () => {
    const malformed = { ...block, metrics: [{ ...block.metrics[0], sourceIds: ["missing"] }] };
    const section = renderFinancialMetrics(malformed, { blockIndex: 4 });
    const item = section.children.find((child) => child.type === "element" && child.tagName === "dl");

    expect(item).toBeDefined();
    expect(JSON.stringify(section)).toContain("Fuente no disponible");
    expect(JSON.stringify(section)).not.toContain('"value":null');
  });
});
