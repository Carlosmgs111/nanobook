import { describe, expect, it } from "vitest";
import type { Document } from "../../../../documents/server/domain/Document";
import type { MarkdownExtension } from "../../../../rendering/shared/MarkdownExtension";
import {
  createRendererFingerprint,
  RENDERER_VERSION,
} from "../../../../rendering/shared/rendererFingerprint";
import { UnifiedMarkdownRenderer } from "./UnifiedMarkdownRenderer";

function documentWith(content: string): Document {
  return { getContent: () => content } as Document;
}

describe("UnifiedMarkdownRenderer", () => {
  it("renders headings with the shared pipeline and no extensions", async () => {
    const renderer = new UnifiedMarkdownRenderer();
    const rendered = await renderer.render(documentWith("# Server"));

    expect(rendered.Content).toBe('<h1 id="server">Server</h1>');
    expect(renderer.fingerprint).toBe(createRendererFingerprint(RENDERER_VERSION, []));
  }, 15_000);

  it("applies and fingerprints the configured SSR extensions", async () => {
    const extensions: readonly MarkdownExtension[] = [{
      id: "section-heading",
      version: "3",
      fenceLanguages: [],
      transform(tree) {
        const heading = tree.children[0];
        if (heading?.type === "element" && heading.tagName === "h1") {
          heading.tagName = "h2";
        }
      },
    }];
    const renderer = new UnifiedMarkdownRenderer(extensions);
    const rendered = await renderer.render(documentWith("# Server"));

    expect(rendered.Content).toBe('<h2 id="server">Server</h2>');
    expect(renderer.fingerprint).toBe(createRendererFingerprint(RENDERER_VERSION, extensions));
  });
});
