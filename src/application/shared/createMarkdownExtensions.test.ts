import { expect, it } from "vitest";
import { renderMarkdown } from "../../rendering/shared/renderMarkdown";
import { createMarkdownExtensions } from "./createMarkdownExtensions";

it("resolves every block fence through a single component-blocks extension", () => {
  const extensions = createMarkdownExtensions();

  expect(extensions.map(({ id, version }) => `${id}@${version}`)).toEqual(["component-blocks@2"]);
  expect([...extensions[0].fenceLanguages].sort()).toEqual([
    "company-profile",
    "counter-demo",
    "financial-chart",
    "financial-metrics",
    "financial-news",
    "financial-sources",
    "price-chart",
  ]);
  expect(createMarkdownExtensions()).not.toBe(extensions);
});

it("renders price-chart as a single framework block between markers", async () => {
  const series = "series:\n  type: line\n  data:\n    - { time: 2026-01-02, value: 10 }";
  const html = await renderMarkdown(`\`\`\`price-chart\n${series}\n\`\`\``, createMarkdownExtensions());

  expect(html.match(/<!--nb:block-start price-chart /g)).toHaveLength(1);
  expect(html).toContain('data-component="price-chart"');
  expect(html).toContain("<!--nb:block-end-->");
}, 30_000);
