import type { Element } from "hast";
import { toString } from "hast-util-to-string";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it, vi } from "vitest";
import { stringify } from "yaml";
import { parseFinancialBlock } from "../parsing/parseFinancialBlock";
import { createFinancialContentExtension } from "./createFinancialContentExtension";
import { renderFinancialBlock } from "./renderFinancialBlock";

const payload = {
  title: "Noticias del trimestre",
  description: "Cobertura reciente.",
  items: [
    {
      title: "La empresa publica sus resultados",
      summary: "La dirección presentó su balance.",
      sourceId: "release",
    },
    {
      title: "Actualización trimestral",
      summary: "El informe resume la actividad.",
      sourceId: "report",
    },
  ],
  sources: [
    {
      id: "report",
      type: "news",
      label: "Boletín del mercado",
      url: "https://example.com/report",
      period: { label: "Primer trimestre de 2026" },
    },
    {
      id: "release",
      type: "news",
      label: "Comunicado de prensa",
      organization: "Agencia Financiera",
      url: "https://example.com/release",
      publishedAt: "2026-03-12",
      period: { label: "Marzo de 2026" },
    },
  ],
};

function elements(parent: Element, tagName: string): Element[] {
  return parent.children.filter((child): child is Element => child.type === "element" && child.tagName === tagName);
}

function render(): Element {
  const block = parseFinancialBlock("financial-news", stringify(payload)).getValue();
  return renderFinancialBlock(block, { blockIndex: 3 });
}

describe("renderFinancialNews", () => {
  it("uses a named section and renders a safely linked headline and summary for each article", () => {
    const section = render();
    const [heading] = elements(section, "h2");
    const articles = elements(section, "article");

    expect(section.tagName).toBe("section");
    expect(toString(heading)).toBe("Noticias del trimestre");
    expect(section.properties.ariaLabelledBy).toBe(heading.properties.id);
    expect(toString(section)).toContain("Cobertura reciente.");
    expect(articles).toHaveLength(2);

    const [firstHeadline] = elements(articles[0], "h3");
    const [secondHeadline] = elements(articles[1], "h3");
    const [link] = elements(firstHeadline, "a");
    expect(toString(link)).toBe("La empresa publica sus resultados (enlace externo, abre en otra pestaña)");
    expect(elements(link, "span")[0].properties).not.toHaveProperty("ariaHidden");
    expect(link.properties).toMatchObject({
      href: "https://example.com/release",
      target: "_blank",
      rel: ["noopener", "noreferrer", "external"],
    });
    expect(toString(articles[0])).toContain("La dirección presentó su balance.");
    const [secondLink] = elements(secondHeadline, "a");
    expect(secondLink.properties.href).toBe("https://example.com/report");
    expect(toString(secondLink)).toBe("Actualización trimestral (enlace externo, abre en otra pestaña)");
    expect(toString(articles[1])).toContain("El informe resume la actividad.");
  });

  it("uses the source organization and date or falls back to the label and period", () => {
    const articles = elements(render(), "article");
    expect(articles).toHaveLength(2);
    const [datedArticle, periodArticle] = articles;
    const dateMetadata = elements(datedArticle, "p").find((child) => elements(child, "time").length > 0);
    expect(dateMetadata).toBeDefined();
    expect(toString(dateMetadata!)).toContain("Agencia Financiera");
    const [time] = elements(dateMetadata!, "time");
    expect(time.properties.dateTime).toBe("2026-03-12");
    expect(toString(time)).toBe("12 mar 2026");
    expect(toString(datedArticle)).not.toContain("Marzo de 2026");
    expect(toString(periodArticle)).toContain("Boletín del mercado");
    expect(toString(periodArticle)).toContain("Primer trimestre de 2026");
  });

  it("renders supplied text and optional references without interpreting markup or fetching sources", () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      throw new Error("Rendering a financial block must not fetch");
    });
    try {
      const block = {
        ...payload,
        items: [{
          ...payload.items[0],
          title: "Resultados <headline>",
          summary: "Balance <summary-tag>",
          relatedTickers: ["ACME", "BETA"],
          mentionedMetrics: ["Margen <metric>"],
        }],
      };
      const html = String(unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(() => createFinancialContentExtension().transform)
        .use(rehypeStringify)
        .processSync(`\`\`\`financial-news\n${stringify(block)}\`\`\``));

      expect(fetch).not.toHaveBeenCalled();
      expect(html).toContain('<section class="financial-block financial-news"');
      expect(html).toMatch(/Resultados (?:&#x3C;|&lt;)headline>/);
      expect(html).toMatch(/Balance (?:&#x3C;|&lt;)summary-tag>/);
      expect(html).toContain("ACME, BETA");
      expect(html).toMatch(/Margen (?:&#x3C;|&lt;)metric>/);
      expect(html).not.toMatch(/<(?:headline|summary-tag|metric)>/);
    } finally {
      fetch.mockRestore();
    }
  });
});
