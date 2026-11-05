import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { renderMarkdown } from "../../../rendering/shared/renderMarkdown";
import { createFinancialContentExtension } from "../index";

const filing = {
  id: "annual-report",
  label: "Informe anual",
  url: "https://example.com/report",
  type: "filing",
  period: { label: "2025" },
};

const company = {
  name: "Ejemplo S. A.",
  ticker: "EJ",
  exchange: "BVC",
  country: "Colombia",
  industry: "Servicios",
  description: "Ofrece servicios de tecnología.",
  reportingCurrency: "COP",
  asOf: "2026-09-30",
  sourceIds: [filing.id],
};

function fence(kind: string, yaml: string): string {
  return `\`\`\`${kind}\n${yaml.trimEnd()}\n\`\`\``;
}

const companyFence = fence("company-profile", stringify({ company, sources: [filing] }));

function render(source: string): Promise<string> {
  return renderMarkdown(source, [createFinancialContentExtension()]);
}

describe("createFinancialContentExtension", () => {
  it("declares the stable extension manifest", () => {
    expect(createFinancialContentExtension()).toMatchObject({
      id: "financial-content",
      version: "1",
      fenceLanguages: [
        "company-profile",
        "financial-chart",
        "financial-metrics",
        "financial-news",
        "financial-sources",
      ],
    });
  });

  it("transforms a known fence even inside a block quote", async () => {
    const html = await render(companyFence.split("\n").map((line) => `> ${line}`).join("\n"));

    expect(html).toMatch(/<blockquote>\s*<section class="financial-block financial-company"/);
    expect(html).not.toContain('class="language-company-profile"');
  }, 15_000);

  it("preserves inline code and unknown or suffixed fences", async () => {
    const html = await render([
      "`company-profile`",
      fence("unrecognized", "plain"),
      fence("company-profile-extra", "plain"),
    ].join("\n\n"));

    expect(html).toContain("<p><code>company-profile</code></p>");
    expect(html).toContain('<pre><code class="language-unrecognized">plain');
    expect(html).toContain('<pre><code class="language-company-profile-extra">plain');
    expect(html).not.toContain('class="financial-block');
  });

  it("requires the exact language class on a direct code child of pre", () => {
    const exact: Element = {
      type: "element",
      tagName: "code",
      properties: { className: ["language-company-profile"] },
      children: [{ type: "text", value: "company: invalid" }],
    };
    const multiple: Element = {
      ...exact,
      properties: { className: ["language-company-profile", "language-yaml"] },
    };
    const children: Element[] = [
      { type: "element", tagName: "p", properties: {}, children: [exact] },
      { type: "element", tagName: "pre", properties: {}, children: [multiple] },
    ];
    const tree: Root = { type: "root", children: structuredClone(children) };

    createFinancialContentExtension().transform(tree);

    expect(tree.children).toEqual(children);
  });

  it("preserves financial fences when the extension is absent", async () => {
    const html = await renderMarkdown(companyFence, []);

    expect(html).toContain('<code class="language-company-profile">');
    expect(html).not.toContain('class="financial-block');
  });

  it("renders an accessible validation error and counts it when indexing later blocks", async () => {
    const invalid = fence("company-profile", stringify({
      company: { ...company, links: [{ label: "Intranet", url: "javascript:private_marker" }] },
      sources: [filing],
    }));
    const html = await render([invalid, "Sigue la nota.", companyFence].join("\n\n"));

    expect(html).toContain('class="financial-block financial-block--error"');
    expect(html).toContain('aria-labelledby="financial-error-0-heading"');
    expect(html).toContain('<h2 id="financial-error-0-heading">');
    expect(html).toContain("company-profile");
    expect(html).toContain("company.links[0].url");
    expect(html).toContain("La URL debe ser absoluta y usar HTTPS.");
    expect(html).not.toContain("private_marker");
    expect(html).not.toContain("Intranet");
    expect(html).toContain("<p>Sigue la nota.</p>");
    expect(html).toContain('<h2 id="financial-company-1-heading">Ejemplo S. A.</h2>');
  });

  it("keeps malformed YAML and parser diagnostics out of the HTML", async () => {
    const html = await render(fence("company-profile", "company: [yaml-secret"));

    expect(html).toContain("El contenido debe ser un documento YAML válido.");
    expect(html).not.toContain("yaml-secret");
    expect(html).not.toContain("company: [");
    expect(html).not.toContain("YAMLParseError");
  });

  it("preserves ordinary content after a valid non-company fence", async () => {
    const sources = fence("financial-sources", stringify({ items: [filing] }));
    const html = await render([sources, "Sigue la nota.", companyFence].join("\n\n"));

    expect(html).toMatch(/^<section class="financial-block /);
    expect(html).not.toContain('class="language-financial-sources"');
    expect(html).toContain("<p>Sigue la nota.</p>");
    expect(html).toContain('<h2 id="financial-company-1-heading">Ejemplo S. A.</h2>');
  });

  it("identifies an invalid cutoff date without exposing the rejected value", async () => {
    const source = fence("company-profile", stringify({
      company: { ...company, asOf: "0000-01-01" },
      sources: [filing],
    }));
    const html = await render([source, "Sigue la nota."].join("\n\n"));

    expect(html).toContain('class="financial-block financial-block--error"');
    expect(html).toContain("company.asOf");
    expect(html).not.toContain("0000-01-01");
    expect(html).not.toContain("Invalid ISO civil date");
    expect(html).toContain("<p>Sigue la nota.</p>");
  });

  it("renders company data and only its cited sources in the same section", async () => {
    const html = await render(fence("company-profile", stringify({
      title: "Ficha de empresa",
      description: "Panorama general.",
      company: { ...company, links: [{ label: "Relación con inversionistas", url: "https://example.com/ir" }] },
      sources: [filing, { ...filing, id: "unreferenced", label: "Informe sin citar", period: { label: "2024" } }],
    })));

    expect(html).toContain('<section class="financial-block financial-company" aria-labelledby="financial-company-0-heading">');
    expect(html).toContain('<h2 id="financial-company-0-heading">Ficha de empresa</h2>');
    expect(html).toContain("<p>Panorama general.</p>");
    expect(html).toContain("<p>Ofrece servicios de tecnología.</p>");
    expect(html).toMatch(/<dl>.*<dd>Ejemplo S\. A\.<\/dd>.*<dt>Ticker<\/dt><dd>EJ<\/dd>.*<dt>Bolsa<\/dt><dd>BVC<\/dd>.*<\/dl>/s);
    expect(html).toContain('<time datetime="2026-09-30">30 sep 2026</time>');
    expect(html).toContain('<a href="https://example.com/ir" target="_blank" rel="noopener noreferrer external">Relación con inversionistas</a>');
    expect(html).toMatch(/<ul[^>]*><li><a href="https:\/\/example\.com\/report" target="_blank" rel="noopener noreferrer external">Informe anual<\/a><\/li><\/ul><\/section>/);
    expect(html).not.toContain("Informe sin citar");
  });

  it("gives repeated company sections distinct IDs and preserves Markdown heading anchors", async () => {
    const html = await render([companyFence, companyFence, "## Fuentes"].join("\n\n"));

    expect(html).toContain('<h3 id="financial-company-0-sources">Fuentes</h3>');
    expect(html).toContain('<h3 id="financial-company-1-sources">Fuentes</h3>');
    expect(html).toContain('<h2 id="fuentes">Fuentes</h2>');
  });

  it("renders HTML-looking titles, descriptions and link labels as text", async () => {
    const html = await render(fence("company-profile", stringify({
      title: "<script>alert(1)</script>",
      company: { ...company, description: "<em>literal</em>" },
      sources: [{ ...filing, label: "<img src=x onerror=alert(1)>" }],
    })));

    expect(html).not.toMatch(/<(?:script|em|img)\b/);
    expect(html).toMatch(/<h2[^>]*>&(?:#x3C|lt);script>alert\(1\)&(?:#x3C|lt);\/script><\/h2>/);
    expect(html).toMatch(/<p>&(?:#x3C|lt);em>literal&(?:#x3C|lt);\/em><\/p>/);
    expect(html).toMatch(/&(?:#x3C|lt);img src=x onerror=alert\(1\)>/);
  });
});
