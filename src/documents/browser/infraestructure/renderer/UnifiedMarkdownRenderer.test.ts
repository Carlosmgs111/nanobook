import { describe, expect, it } from "vitest";
import type { MarkdownExtension } from "../../../../rendering/shared/MarkdownExtension";
import { z } from "zod";
import { createComponentBlocksExtension } from "../../../../rendering/shared/componentBlocks/createComponentBlocksExtension";
import { EditionRenderError } from "../../domain/errors";
import { UnifiedMarkdownRenderer } from "./UnifiedMarkdownRenderer";

const createBlockExtension = () =>
  createComponentBlocksExtension({
    id: "demo-blocks",
    version: "1",
    definitions: [{ name: "demo-block", props: z.object({ count: z.number() }) }],
  });

describe("UnifiedMarkdownRenderer", () => {
  const blockFence = "```demo-block\ninvalid\n```";

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

  it("keeps the preview extension configuration after caller array mutations", async () => {
    const initiallyEmpty: MarkdownExtension[] = [];
    const plainRenderer = new UnifiedMarkdownRenderer(initiallyEmpty);
    initiallyEmpty.push(createBlockExtension());

    const configured = [createBlockExtension()];
    const blockRenderer = new UnifiedMarkdownRenderer(configured);
    configured[0] = { id: "other", version: "1", fenceLanguages: [], transform() {} };

    const plain = await plainRenderer.render(blockFence);
    const withBlocks = await blockRenderer.render(blockFence);

    expect(plain.isSuccess).toBe(true);
    expect(plain.getValue().Content).toContain('<code class="language-demo-block">');
    expect(withBlocks.isSuccess).toBe(true);
    expect(withBlocks.getValue().Content).toContain("component-block-error");
  });
});
