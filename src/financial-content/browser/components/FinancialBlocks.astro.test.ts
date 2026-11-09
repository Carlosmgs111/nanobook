import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { financialBlockProps } from "../../shared/components/financialBlockProps";
import type { FinancialFenceKind } from "../../shared/model/FinancialBlock";
import { financialGuideExamples } from "../../shared/guide/financialAuthoringGuide";
import CompanyProfile from "./CompanyProfile.astro";
import FinancialChart from "./FinancialChart.astro";
import FinancialNews from "./FinancialNews.astro";
import FinancialSources from "./FinancialSources.astro";

const components = {
  "company-profile": CompanyProfile,
  "financial-chart": FinancialChart,
  "financial-news": FinancialNews,
  "financial-sources": FinancialSources,
} as const;

type Kind = keyof typeof components;

function propsFor(kind: FinancialFenceKind, edit: (source: string) => string = (source) => source) {
  return financialBlockProps(kind).parse(parse(edit(financialGuideExamples[kind])));
}

async function render(kind: Kind, props: unknown, request?: Request): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(components[kind] as never, { props: props as never, request });
}

describe.each(Object.keys(components) as Kind[])("%s (.astro)", (kind) => {
  it("renders one labelled section or figure with no scripts", async () => {
    const html = await render(kind, propsFor(kind));

    expect(html).toMatch(new RegExp(`class="financial-block ${kind === "company-profile" ? "financial-company" : kind}"`));
    expect(html).toContain("aria-labelledby=");
    expect(html).not.toContain("<script");
  });

  it("gives unique ids to two blocks rendered in the same request", async () => {
    const request = new Request("https://example.com/");
    const first = await render(kind, propsFor(kind), request);
    const second = await render(kind, propsFor(kind), request);
    const ids = (html: string) => [...html.matchAll(/ id="(financial:[^"]+)"/g)].map(([, id]) => id);

    expect(ids(first).length).toBeGreaterThan(0);
    expect(ids(first).filter((id) => ids(second).includes(id))).toEqual([]);
  });

  it("escapes author text instead of injecting markup", async () => {
    const props = propsFor(kind, (source) => source.replace(/^title: .*/m, "title: <img src=x onerror=alert(1)>"));
    const html = await render(kind, { ...props, title: "<img src=x onerror=alert(1)>" });

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("links every external source safely", async () => {
    const html = await render(kind, propsFor(kind));
    const anchors = [...html.matchAll(/<a [^>]*>/g)].map(([tag]) => tag);

    expect(anchors.length).toBeGreaterThan(0);
    for (const anchor of anchors) {
      expect(anchor).toContain('href="https://');
      expect(anchor).toContain('rel="noopener noreferrer external"');
      expect(anchor).toContain('target="_blank"');
    }
  });
});

describe("financial-chart (.astro)", () => {
  it("draws an accessible SVG with its title and description", async () => {
    const html = await render("financial-chart", propsFor("financial-chart"));

    expect(html).toContain('<svg class="financial-chart__plot"');
    expect(html).toContain('role="img"');
    expect(html).toMatch(/<title id="financial:chart-0-title">/);
    expect(html).toMatch(/<desc id="financial:chart-0-description">/);
  });

  it("offers the data as a keyboard-scrollable table inside a disclosure", async () => {
    const html = await render("financial-chart", propsFor("financial-chart"));

    expect(html).toContain('<details class="financial-chart__data">');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Datos del gráfico"');
    expect(html).toContain('<th scope="col">Categoría</th>');
  });

  it("shows 'Sin dato' for a missing value", async () => {
    const html = await render("financial-chart", propsFor("financial-chart"));

    expect(html).toContain("Sin dato");
  });
});

describe("financial-news (.astro)", () => {
  it("marks the external headline link for screen readers", async () => {
    const html = await render("financial-news", propsFor("financial-news"));

    expect(html).toContain("(enlace externo, abre en otra pestaña)");
  });
});

describe("financial-sources (.astro)", () => {
  it("lists each source with its type label", async () => {
    const html = await render("financial-sources", propsFor("financial-sources"));

    expect(html).toContain('<ol class="financial-sources__list">');
    expect(html).toMatch(/Reporte regulatorio|Resultados|Noticia|Conjunto de datos|Otra fuente/);
  });
});

describe("company-profile (.astro)", () => {
  it("shows the cut-off date and the cited sources", async () => {
    const html = await render("company-profile", propsFor("company-profile"));

    expect(html).toContain("Fecha de corte");
    expect(html).toContain('<ul class="financial-company__sources">');
  });
});
