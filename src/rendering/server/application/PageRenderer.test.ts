import { describe, expect, it, vi } from "vitest";
import type { MarkdownEngine } from "../../shared";
import { Result } from "../../../shared/domain/Result";
import type { CachedPage, RenderedPageCache } from "../domain/RenderedPageCache";
import { PageRenderer } from "./PageRenderer";

function createCache(): RenderedPageCache {
  const entries = new Map<string, CachedPage>();
  return {
    async get(pageId, contentHash) {
      const entry = entries.get(pageId);
      return entry?.contentHash === contentHash ? entry : null;
    },
    async set(pageId, contentHash, html) {
      entries.set(pageId, { pageId, contentHash, html, renderedAt: "2026-01-01T00:00:00.000Z" });
    },
    async invalidate(pageIds) {
      for (const pageId of pageIds) entries.delete(pageId);
      return Result.ok();
    },
  };
}

const page = { id: "server-doc", contentHash: "content-hash", content: "# Server" };

function engineWith(fingerprint: string, html: string) {
  return { fingerprint, render: vi.fn(async () => html) } satisfies MarkdownEngine;
}

describe("PageRenderer", () => {
  it.each([
    ["extension version", "2|first@1", "2|first@2"],
    ["active extension set", "2", "2|first@1"],
    ["extension order", "2|first@1|second@1", "2|second@1|first@1"],
  ])("rerenders when the %s changes", async (_, firstFingerprint, secondFingerprint) => {
    const cache = createCache();
    const first = engineWith(firstFingerprint, "<p>First</p>");
    const second = engineWith(secondFingerprint, "<p>Second</p>");

    expect(await new PageRenderer(first, cache).render(page)).toBe("<p>First</p>");
    expect(await new PageRenderer(second, cache).render(page)).toBe("<p>Second</p>");
    expect(first.render).toHaveBeenCalledOnce();
    expect(second.render).toHaveBeenCalledOnce();
  });

  it("reuses cached HTML when the engine and the content match", async () => {
    const cache = createCache();
    const first = engineWith("2|first@1", "<p>Cached</p>");
    const second = engineWith("2|first@1", "<p>Uncached</p>");

    await new PageRenderer(first, cache).render(page);
    const html = await new PageRenderer(second, cache).render(page);

    expect(html).toBe("<p>Cached</p>");
    expect(second.render).not.toHaveBeenCalled();
  });

  it("rerenders after the page is invalidated", async () => {
    const engine = engineWith("2", "<p>Server</p>");
    const renderer = new PageRenderer(engine, createCache());

    await renderer.render(page);
    expect((await renderer.invalidate([page.id])).isSuccess).toBe(true);
    await renderer.render(page);

    expect(engine.render).toHaveBeenCalledTimes(2);
  });
});
