import { describe, expect, it } from "vitest";
import type { MarkdownExtension } from "./MarkdownExtension";
import { renderMarkdown } from "./renderMarkdown";
import { createRendererFingerprint, RENDERER_VERSION } from "./rendererFingerprint";

function extension(
  id: string,
  version: string,
  fenceLanguages: readonly string[],
  calls: string[],
): MarkdownExtension {
  return {
    id,
    version,
    fenceLanguages,
    transform() {
      calls.push(id);
    },
  };
}

describe("renderMarkdown", () => {
  it("renders the existing markdown contract without extensions", async () => {
    const html = await renderMarkdown("# Hello\n\n- [x] Done");
    expect(html).toContain('<h1 id="hello">Hello</h1>');
    expect(html).toContain('class="contains-task-list"');
  }, 15_000);

  it("preserves unknown and graph fences", async () => {
    expect(await renderMarkdown("```graph\nA -> B\n```"))
      .toContain('<code class="language-graph">');
    expect(await renderMarkdown("```unknown\nvalue\n```"))
      .toContain('<code class="language-unknown">');
  });

  it("applies extensions in registration order without changing siblings", async () => {
    const calls: string[] = [];
    const extensions = [
      extension("first", "1", ["first"], calls),
      extension("second", "3", ["second"], calls),
    ];

    const html = await renderMarkdown("Paragraph", extensions);

    expect(calls).toEqual(["first", "second"]);
    expect(html).toContain("<p>Paragraph</p>");
  });

  it("fingerprints extension identity version and order", () => {
    const firstV1 = extension("first", "1", [], []);
    const firstV2 = extension("first", "2", [], []);
    const secondV3 = extension("second", "3", [], []);

    expect(createRendererFingerprint(RENDERER_VERSION, [firstV1, secondV3]))
      .toBe("2|first@1|second@3");
    expect(createRendererFingerprint(RENDERER_VERSION, [secondV3, firstV1]))
      .toBe("2|second@3|first@1");
    expect(createRendererFingerprint(RENDERER_VERSION, [firstV2, secondV3]))
      .toBe("2|first@2|second@3");
  });

  it("rejects duplicate extension ids", async () => {
    const calls: string[] = [];
    const firstV1 = extension("first", "1", [], calls);
    const firstV2 = extension("first", "2", [], calls);

    await expect(renderMarkdown("Paragraph", [firstV1, firstV2]))
      .rejects.toThrow("Duplicate Markdown extension id: first");
    expect(() => createRendererFingerprint(RENDERER_VERSION, [firstV1, firstV2]))
      .toThrow("Duplicate Markdown extension id: first");
    expect(calls).toEqual([]);
  });
});
