import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { InMemoryDocumentSourceCache } from "./InMemoryDocumentSourceCache";

function document(path = "guide") {
  const date = new Date("2026-11-01T12:00:00.000Z");
  return Document.create(path, { id: "doc-1", title: "Guide", description: "Guide", secured: true, createdAt: date, updatedAt: date }, "# Guide").getValue();
}

describe("InMemoryDocumentSourceCache", () => {
  it("reuses the stored source, rebuilt from its snapshot, until the nanobook is invalidated", async () => {
    const cache = new InMemoryDocumentSourceCache();
    const load = vi.fn(async () => Result.ok(document()));

    await cache.getOrLoad("book", "guide", load);
    const cached = (await cache.getOrLoad("book", "guide", load)).getValue();
    expect(load).toHaveBeenCalledTimes(1);
    expect(cached?.getContent()).toBe("# Guide");
    expect(cached?.getMetadata().secured).toBe(true);

    await cache.invalidateNanobook("book");
    await cache.getOrLoad("book", "guide", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps nanobooks apart and does not cache missing documents", async () => {
    const cache = new InMemoryDocumentSourceCache();
    const load = vi.fn(async () => Result.ok(document()));
    await cache.getOrLoad("book-a", "guide", load);
    await cache.getOrLoad("book-b", "guide", load);
    expect(load).toHaveBeenCalledTimes(2);

    const missing = vi.fn(async () => Result.ok(null));
    await cache.getOrLoad("book-a", "nope", missing);
    await cache.getOrLoad("book-a", "nope", missing);
    expect(missing).toHaveBeenCalledTimes(2);
  });
});
