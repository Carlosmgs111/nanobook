import { describe, expect, it } from "vitest";
import type { MarkdownExtension } from "../../../../rendering/shared/MarkdownExtension";
import { EditionRenderError } from "../../domain/errors";
import { UnifiedMarkdownRenderer } from "./UnifiedMarkdownRenderer";

describe("UnifiedMarkdownRenderer", () => {
  it("renders markdown through the PreviewRenderer contract", async () => {
    const renderer = new UnifiedMarkdownRenderer();

    const result = await renderer.render("# Hello");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual({ Content: '<h1 id="hello">Hello</h1>' });
  }, 15_000);

  it("preserves the graph fence marker for graph-specific presentation", async () => {
    const renderer = new UnifiedMarkdownRenderer();

    const result = await renderer.render("```graph\n┌───┐\n│   │\n└───┘\n```");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().Content).toContain('<code class="language-graph">');
    expect(result.getValue().Content).toContain("┌───┐");
  }, 15_000);

  it("wraps shared renderer failures as EditionRenderError", async () => {
    const failure = new Error("extension failed");
    const throwingExtension: MarkdownExtension = {
      id: "throwing",
      version: "1",
      fenceLanguages: [],
      transform() {
        throw failure;
      },
    };
    const renderer = new UnifiedMarkdownRenderer([throwingExtension]);

    const result = await renderer.render("Paragraph");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionRenderError);
    expect(result.getError().message).toBe("extension failed");
    expect(result.getError().cause).toBe(failure);
  });
});
