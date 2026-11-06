import { describe, expect, it } from "vitest";
import type { Document } from "../../../../documents/server/domain/Document";
import { createFinancialContentExtension } from "../../../../financial-content/shared";
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
  const financialFence = "```financial-metrics\ninvalid\n```";

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

  it("keeps the original empty configuration after the caller adds a financial extension", async () => {
    const extensions: MarkdownExtension[] = [];
    const renderer = new UnifiedMarkdownRenderer(extensions);
    extensions.push(createFinancialContentExtension());

    const rendered = await renderer.render(documentWith(financialFence));

    expect(renderer.fingerprint).toBe(RENDERER_VERSION);
    expect(rendered.Content).toContain('<code class="language-financial-metrics">');
    expect(rendered.Content).not.toContain("financial-block");
  });

  it("keeps configured extensions after the caller removes or replaces entries", async () => {
    const extensions = [createFinancialContentExtension()];
    const removedRenderer = new UnifiedMarkdownRenderer(extensions);
    extensions.pop();
    const configured = [createFinancialContentExtension()];
    const renderer = new UnifiedMarkdownRenderer(configured);
    configured[0] = { id: "other", version: "1", fenceLanguages: [], transform() {} };

    const removed = await removedRenderer.render(documentWith(financialFence));
    const replaced = await renderer.render(documentWith(financialFence));

    expect(removedRenderer.fingerprint).toBe(`${RENDERER_VERSION}|financial-content@1`);
    expect(renderer.fingerprint).toBe(`${RENDERER_VERSION}|financial-content@1`);
    expect(removed.Content).toContain('class="financial-block financial-block--error"');
    expect(replaced.Content).toContain('class="financial-block financial-block--error"');
  });
});
