import { describe, expect, it } from "vitest";
import type { MarkdownExtension } from "../../../../rendering/shared/MarkdownExtension";
import { EditionRenderError } from "../../domain/errors";
import { UnifiedMarkdownRenderer } from "./UnifiedMarkdownRenderer";

describe("UnifiedMarkdownRenderer", () => {
  it("renderiza Markdown con el contrato PreviewRenderer", async () => {
    const result = await new UnifiedMarkdownRenderer().render("# Hello");

    expect(result.getValue()).toEqual({ Content: '<h1 id="hello">Hello</h1>' });
  }, 15_000);

  it("envuelve los fallos de renderizado en EditionRenderError", async () => {
    const failure = new Error("extension failed");
    const throwing: MarkdownExtension = {
      id: "throwing",
      version: "1",
      fenceLanguages: [],
      transform() { throw failure; },
    };

    const result = await new UnifiedMarkdownRenderer([throwing]).render("Paragraph");

    expect(result.getError()).toBeInstanceOf(EditionRenderError);
    expect(result.getError().cause).toBe(failure);
  });
});
