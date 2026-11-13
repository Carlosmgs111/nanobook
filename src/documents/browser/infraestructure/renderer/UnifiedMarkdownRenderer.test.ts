import { describe, expect, it, vi } from "vitest";
import { EditionRenderError } from "../../domain/errors";
import { UnifiedMarkdownRenderer } from "./UnifiedMarkdownRenderer";

describe("UnifiedMarkdownRenderer", () => {
  it("renders markdown through the PreviewRenderer contract", async () => {
    const render = vi.fn().mockResolvedValue("<h1>Hello</h1>");
    const renderer = new UnifiedMarkdownRenderer({ render });

    const result = await renderer.render("# Hello");

    expect(render).toHaveBeenCalledWith("# Hello");
    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual({ Content: "<h1>Hello</h1>" });
  });

  it("wraps engine failures as EditionRenderError", async () => {
    const failure = new Error("extension failed");
    const renderer = new UnifiedMarkdownRenderer({ render: vi.fn().mockRejectedValue(failure) });

    const result = await renderer.render("Paragraph");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EditionRenderError);
    expect(result.getError().message).toBe("extension failed");
    expect(result.getError().cause).toBe(failure);
  });
});
