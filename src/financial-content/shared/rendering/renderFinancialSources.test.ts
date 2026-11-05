import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { renderMarkdown } from "../../../rendering/shared/renderMarkdown";
import type { FinancialSourcesBlock } from "../model/FinancialBlock";
import { createFinancialContentExtension } from "./createFinancialContentExtension";
import { renderFinancialSources } from "./renderFinancialSources";

const block: FinancialSourcesBlock = {
  kind: "financial-sources",
  version: 1,
  title: "Bibliografía",
  description: "Documentos consultados.",
  items: [
    { id: "second", label: "Resultados trimestrales", organization: "Acme", url: "https://example.com/results", type: "earnings", publishedAt: "2026-02-10", accessedAt: "2026-03-01" },
    { id: "first", label: "Informe anual", organization: "Bolsa", url: "https://example.com/annual", type: "filing", period: { label: "Año fiscal 2025", from: "2025-01-01", to: "2025-12-31" } },
  ],
};

describe("renderFinancialSources", () => {
  it("renders sources in author order with metadata, dates and safe links", async () => {
    const { kind: _kind, version: _version, ...payload } = block;
    const html = await renderMarkdown(`\`\`\`financial-sources\n${stringify(payload)}\`\`\``, [createFinancialContentExtension()]);

    expect(html).toContain('<section class="financial-block financial-sources" aria-labelledby="financial:sources-0-heading">');
    expect(html).toContain('<h2 id="financial:sources-0-heading">Bibliografía</h2>');
    expect(html).toContain('<ol class="financial-sources__list">');
    expect(html.indexOf("Resultados trimestrales")).toBeLessThan(html.indexOf("Informe anual"));
    expect(html).toContain("Acme");
    expect(html).toContain("Bolsa");
    expect(html).toContain("Resultados");
    expect(html).toContain("Reporte regulatorio");
    expect(html).toContain('<time datetime="2026-02-10">10 feb 2026</time>');
    expect(html).toContain('<time datetime="2026-03-01">1 mar 2026</time>');
    expect(html).toContain("Año fiscal 2025");
    expect(html).toContain('<a href="https://example.com/results" target="_blank" rel="noopener noreferrer external">Resultados trimestrales</a>');
  });

  it("uses distinct IDs and text nodes for repeated bibliography blocks", () => {
    const first = renderFinancialSources({ ...block, title: "<em>Bibliografía</em>" }, { blockIndex: 1 });
    const second = renderFinancialSources(block, { blockIndex: 2 });

    expect(first.properties.ariaLabelledBy).toBe("financial:sources-1-heading");
    expect(second.properties.ariaLabelledBy).toBe("financial:sources-2-heading");
    expect(JSON.stringify(first)).toContain("<em>Bibliografía</em>");
    expect(JSON.stringify(first)).not.toContain('"tagName":"em"');
  });
});
