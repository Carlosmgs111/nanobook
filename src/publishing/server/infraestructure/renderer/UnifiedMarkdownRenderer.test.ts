import { describe, expect, it, vi } from "vitest";
import { UnifiedMarkdownRenderer } from "./UnifiedMarkdownRenderer";

describe("UnifiedMarkdownRenderer", () => {
  it("renders the document content through the injected engine", async () => {
    const render = vi.fn().mockResolvedValue("<p>html</p>");
    const renderer = new UnifiedMarkdownRenderer({ fingerprint: "2|demo@1", render });

    const rendered = await renderer.render({ getContent: () => "texto" });

    expect(render).toHaveBeenCalledWith("texto");
    expect(rendered).toEqual({ Content: "<p>html</p>" });
  });

  it("exposes the engine fingerprint as its own", () => {
    const renderer = new UnifiedMarkdownRenderer({ fingerprint: "2|demo@1", render: vi.fn() });

    expect(renderer.fingerprint).toBe("2|demo@1");
  });
});
