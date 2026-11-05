import { describe, expect, it } from "vitest";
import { UnifiedMarkdownRenderer as PreviewRenderer } from "../../documents/browser/infraestructure/renderer/UnifiedMarkdownRenderer";
import { UnifiedMarkdownRenderer as ServerRenderer } from "../../publishing/server/infraestructure/renderer/UnifiedMarkdownRenderer";
import type { MarkdownExtension } from "./MarkdownExtension";

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
];

describe("Markdown renderer parity", () => {
  const server = new ServerRenderer();
  const preview = new PreviewRenderer();

  it.each(sources)("renders identical HTML for $name", async ({ source, marker }) => {
    const published = await server.render({ getContent: () => source });
    const result = await preview.render(source);

    expect(result.isSuccess).toBe(true);
    expect(published.Content).toContain(marker);
    expect(result.getValue().Content).toBe(published.Content);
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
