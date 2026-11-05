import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMarkdownExtensions } from "../../application/browser/createMarkdownExtensions";
import { UnifiedMarkdownRenderer as PreviewRenderer } from "../../documents/browser/infraestructure/renderer/UnifiedMarkdownRenderer";
import { createFinancialContentExtension } from "../../financial-content/shared";
import { UnifiedMarkdownRenderer as ServerRenderer } from "../../publishing/server/infraestructure/renderer/UnifiedMarkdownRenderer";
import type { MarkdownExtension } from "./MarkdownExtension";

const financialNote = readFileSync(new URL(
  "../../financial-content/shared/test/fixtures/alphabet-analysis.md",
  import.meta.url,
), "utf8");

const sources = [
  {
    name: "repeated headings",
    source: "# Repeated\n\n## Repeated\n\n## Repeated",
    marker: 'id="repeated-2"',
  },
  {
    name: "a GFM table",
    source: "| A | B |\n| - | - |\n| 1 | 2 |",
    marker: "<table>",
  },
  {
    name: "a graph fence",
    source: "```graph\nA -> B\n```",
    marker: '<code class="language-graph">',
  },
  {
    name: "a highlighted TypeScript fence",
    source: "```ts\nconst value = 1;\n```",
    marker: 'class="shiki github-dark"',
  },
  {
    name: "a full financial note",
    source: financialNote,
    marker: 'class="financial-block financial-sources"',
  },
];

describe("Markdown renderer parity", () => {
  const server = new ServerRenderer([createFinancialContentExtension()]);
  const preview = new PreviewRenderer(createMarkdownExtensions());
  const serverWithoutExtensions = new ServerRenderer();

  it.each(sources)("renders identical HTML for $name", async ({ source, marker }) => {
    const published = await server.render({ getContent: () => source });
    const result = await preview.render(source);

    expect(result.isSuccess).toBe(true);
    expect(published.Content).toContain(marker);
    expect(result.getValue().Content).toBe(published.Content);
    if (source !== financialNote) {
      const baseline = await serverWithoutExtensions.render({ getContent: () => source });
      expect(published.Content).toBe(baseline.Content);
    }
  }, 15_000);

  it("renders identical HTML with a configured extension", async () => {
    const extensions: readonly MarkdownExtension[] = [{
      id: "paragraph-marker",
      version: "1",
      fenceLanguages: [],
      transform(tree) {
        tree.children.push({ type: "text", value: "From extension" });
      },
    }];
    const source = "Paragraph";
    const published = await new ServerRenderer(extensions).render({ getContent: () => source });
    const result = await new PreviewRenderer(extensions).render(source);

    expect(result.isSuccess).toBe(true);
    expect(published.Content).toBe("<p>Paragraph</p>From extension");
    expect(result.getValue().Content).toBe(published.Content);
  });
});
