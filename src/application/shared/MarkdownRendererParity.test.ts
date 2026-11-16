import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { counterDemoBlock } from "../browser/components/CounterDemo/counterDemoBlock";
import { FinancialContentModule } from "../../financial-content/browser";
import {
  createComponentBlocksExtension,
  createMarkdownEngine,
  createBlockRegistry,
  type MarkdownExtension,
} from "../../rendering/shared";
import { UnifiedMarkdownRenderer as PreviewRenderer } from "../../documents/browser/infraestructure/renderer/UnifiedMarkdownRenderer";

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
    name: "a full financial note (component blocks)",
    source: financialNote,
    marker: 'data-component="financial-sources"',
  },
];

describe("Markdown renderer parity", () => {
  const blockEngine = () => {
    const blocks = createBlockRegistry();
    FinancialContentModule.create(blocks);
    blocks.register([counterDemoBlock]);
    return createMarkdownEngine([createComponentBlocksExtension(blocks)]);
  };
  const server = blockEngine();
  const preview = new PreviewRenderer(blockEngine());
  const serverWithoutExtensions = createMarkdownEngine();

  it.each(sources)("renders identical HTML for $name", async ({ source, marker }) => {
    const published = await server.render(source);
    const result = await preview.render(source);

    expect(result.isSuccess).toBe(true);
    expect(published).toContain(marker);
    expect(result.getValue().Content).toBe(published);
    if (source !== financialNote) {
      expect(published).toBe(await serverWithoutExtensions.render(source));
    }
  }, 15_000);

  it("renders identical HTML with a configured extension", async () => {
    const extensions: readonly MarkdownExtension[] = [{
      id: "paragraph-marker",
      version: "1",
      transform(tree) {
        tree.children.push({ type: "text", value: "From extension" });
      },
    }];
    const source = "Paragraph";
    const published = await createMarkdownEngine(extensions).render(source);
    const result = await new PreviewRenderer(createMarkdownEngine(extensions)).render(source);

    expect(result.isSuccess).toBe(true);
    expect(published).toBe("<p>Paragraph</p>From extension");
    expect(result.getValue().Content).toBe(published);
  });
});
