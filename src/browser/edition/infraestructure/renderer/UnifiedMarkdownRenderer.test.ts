import { describe, expect, it } from "vitest";
import { UnifiedMarkdownRenderer } from "./UnifiedMarkdownRenderer";

describe("UnifiedMarkdownRenderer", () => {
  it("renders markdown through the PreviewRenderer contract", async () => {
    const renderer = new UnifiedMarkdownRenderer();

    const result = await renderer.render("# Hello");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual({ Content: '<h1 id="hello">Hello</h1>' });
  }, 15_000);
});
