import { describe, expect, it, vi } from "vitest";
import { Document } from "../../../documents/server/domain/Document";
import { Result } from "../../../shared/domain/Result";
import type { CachedPage, RenderedPageCache } from "../domain/cache";
import type { DocumentRenderer } from "../domain/render";
import { PagePublisher } from "./PagePublisher";

function createCache(): RenderedPageCache {
  const entries = new Map<string, CachedPage>();

  return {
    async get(pageId, contentHash) {
      const entry = entries.get(pageId);
      return entry?.contentHash === contentHash ? entry : null;
    },
    async set(pageId, contentHash, html) {
      entries.set(pageId, {
        pageId,
        contentHash,
        html,
        renderedAt: "2026-01-01T00:00:00.000Z",
      });
    },
    async invalidate(pageIds) {
      for (const pageId of pageIds) entries.delete(pageId);
      return Result.ok();
    },
  };
}

function createDocument(): Document {
  const document = Document.create("/server", {
    id: "server-doc",
    title: "Server",
    description: "Test document",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }, "# Server").getValue();
  vi.spyOn(document, "computeContentHash").mockResolvedValue("content-hash");
  return document;
}

function rendererWith(fingerprint: string, html: string) {
  return {
    fingerprint,
    render: vi.fn(async () => ({ Content: html })),
  } satisfies DocumentRenderer;
}

describe("PagePublisher", () => {
  it.each([
    ["extension version", "2|first@1", "2|first@2"],
    ["active extension set", "2", "2|first@1"],
    ["extension order", "2|first@1|second@1", "2|second@1|first@1"],
  ])("rerenders when the %s changes", async (_, firstFingerprint, secondFingerprint) => {
    const document = createDocument();
    const cache = createCache();
    const firstRenderer = rendererWith(firstFingerprint, "<p>First</p>");
    const secondRenderer = rendererWith(secondFingerprint, "<p>Second</p>");

    const first = await new PagePublisher(firstRenderer, cache).publish(document);
    const second = await new PagePublisher(secondRenderer, cache).publish(document);

    expect(first?.rendered.renderedBody).toBe("<p>First</p>");
    expect(second?.rendered.renderedBody).toBe("<p>Second</p>");
    expect(firstRenderer.render).toHaveBeenCalledOnce();
    expect(secondRenderer.render).toHaveBeenCalledOnce();
  });

  it("reuses cached HTML when the renderer and content match", async () => {
    const document = createDocument();
    const cache = createCache();
    const firstRenderer = rendererWith("2|first@1", "<p>Cached</p>");
    const secondRenderer = rendererWith("2|first@1", "<p>Uncached</p>");

    await new PagePublisher(firstRenderer, cache).publish(document);
    const result = await new PagePublisher(secondRenderer, cache).publish(document);

    expect(result?.rendered.renderedBody).toBe("<p>Cached</p>");
    expect(secondRenderer.render).not.toHaveBeenCalled();
  });

  it("returns the original content hash to page consumers", async () => {
    const publisher = new PagePublisher(rendererWith("2|first@1", "<p>Server</p>"), createCache());
    const result = await publisher.publish(createDocument());

    expect(result?.contentHash).toBe("content-hash");
  });
});
