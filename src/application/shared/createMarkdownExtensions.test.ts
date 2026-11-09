import { expect, it } from "vitest";
import { renderMarkdown } from "../../rendering/shared/renderMarkdown";
import { createMarkdownExtensions } from "./createMarkdownExtensions";

it("registers the five financial fences in each browser extension list", () => {
  const extensions = createMarkdownExtensions();

  expect(extensions.map(({ id, version }) => `${id}@${version}`)).toEqual([
    "financial-content@1",
    "component-blocks@1",
  ]);
  expect(extensions[0].fenceLanguages).toEqual([
    "company-profile",
    "financial-chart",
    "financial-metrics",
    "financial-news",
    "financial-sources",
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
