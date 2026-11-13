import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import { blockDefinitions } from "../../../../application/shared/blocks";
import { RenderingModule } from "../../../../rendering/server";
import FinancialMetrics from "./FinancialMetrics.astro";
const blockRegistry = RenderingModule.create(blockDefinitions).blocks;

const props = blockRegistry.find("financial-metrics")!.props.parse({
  version: 1,
  metrics: [
    {
      label: "Margen ilustrativo",
      value: 12,
      unit: "percent",
      period: { label: "2024", from: "2024-01-01", to: "2024-12-31" },
      description: "Dato de ejemplo",
      comparison: { label: "Año previo", value: 10, direction: "favorable" },
      sourceIds: ["example"],
    },
  ],
  sources: [
    {
      id: "example",
      label: "Fuente de ejemplo",
      url: "https://example.com/metrics",
      type: "dataset",
      publishedAt: "2025-02-03",
    },
  ],
});

async function render(blockProps = props): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(FinancialMetrics, { props: blockProps });
}

describe("FinancialMetrics (.astro)", () => {
  it("renders the section with its labelled heading and the formatted value", async () => {
    const html = await render();

    expect(html).toContain('class="financial-block financial-metrics"');
    expect(html).toContain('aria-labelledby="financial:metrics-0-heading"');
    expect(html).toContain("Métricas financieras");
    expect(html).toContain("12,0 %");
  });

  it("renders the period with machine-readable dates", async () => {
    const html = await render();

    expect(html).toContain("2024");
    expect(html).toContain('<time datetime="2024-01-01">1 ene 2024</time>');
    expect(html).toContain(" hasta ");
  });

  it("renders the comparison with its direction", async () => {
    const html = await render();

    expect(html).toContain('data-direction="favorable"');
    expect(html).toContain("Año previo: 10,0 % · Favorable");
  });

  it("links the cited source externally and shows its publication date", async () => {
    const html = await render();

    expect(html).toContain('href="https://example.com/metrics"');
    expect(html).toContain('rel="noopener noreferrer external"');
    expect(html).toContain("Fuente de ejemplo");
    expect(html).toContain(" · Publicado ");
    expect(html).toContain('<time datetime="2025-02-03">3 feb 2025</time>');
  });

  it("links the description to the value for assistive technology", async () => {
    const html = await render();

    expect(html).toContain('aria-describedby="financial:metrics-0-metric-0-description"');
    expect(html).toContain('id="financial:metrics-0-metric-0-description"');
  });

  it("emits no scripts, since the block is server-only", async () => {
    expect(await render()).not.toContain("<script");
  });
});
