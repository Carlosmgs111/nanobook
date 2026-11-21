import type { RuntimeCache } from "@vercel/functions";
import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { VercelDocumentSourceCache } from "./VercelDocumentSourceCache";

/** Runtime Cache en memoria: `expireTag` borra las entradas etiquetadas, como la real. */
function runtimeCache(): RuntimeCache {
  const values = new Map<string, unknown>();
  const tagged = new Map<string, Set<string>>();
  return {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown, options?: { tags?: string[] }) => {
      values.set(key, value);
      for (const tag of options?.tags ?? []) {
        tagged.set(tag, (tagged.get(tag) ?? new Set()).add(key));
      }
    }),
    delete: vi.fn(async (key: string) => void values.delete(key)),
    expireTag: vi.fn(async (tag: string | string[]) => {
      for (const name of Array.isArray(tag) ? tag : [tag]) {
        for (const key of tagged.get(name) ?? []) values.delete(key);
        tagged.delete(name);
      }
    }),
  };
}

function document(path: string, content = "# Guide") {
  const date = new Date("2026-11-01T12:00:00.000Z");
  return Document.create(path, { id: path, title: path, description: path, createdAt: date, updatedAt: date }, content).getValue();
}

describe("VercelDocumentSourceCache", () => {
  it("reuses the stored entry until the nanobook tag is expired", async () => {
    const runtime = runtimeCache();
    const cache = new VercelDocumentSourceCache(runtime);
    const load = vi.fn(async () => Result.ok(document("guide")));

    await cache.getOrLoad("book-a", "guide", load);
    await cache.getOrLoad("book-a", "guide", load);
    expect(load).toHaveBeenCalledTimes(1);

    await cache.invalidateNanobook("book-a");
    await cache.getOrLoad("book-a", "guide", load);

    expect(load).toHaveBeenCalledTimes(2);
    expect(runtime.expireTag).toHaveBeenCalledWith("nanobook:book-a");
    expect(runtime.set).toHaveBeenCalledWith(
      "book-a:guide",
      expect.any(Object),
      expect.objectContaining({ ttl: 3600, tags: ["nanobook:book-a"] }),
    );
  });

  it("reads a cached document with a single cache lookup", async () => {
    const runtime = runtimeCache();
    const cache = new VercelDocumentSourceCache(runtime);
    const load = vi.fn(async () => Result.ok(document("guide")));
    await cache.getOrLoad("book-a", "guide", load);
    vi.mocked(runtime.get).mockClear();

    await cache.getOrLoad("book-a", "guide", load);

    expect(runtime.get).toHaveBeenCalledTimes(1);
  });

  it("only expires the entries of the invalidated nanobook", async () => {
    const runtime = runtimeCache();
    const cache = new VercelDocumentSourceCache(runtime);
    const loadA = vi.fn(async () => Result.ok(document("guide")));
    const loadB = vi.fn(async () => Result.ok(document("guide")));
    await cache.getOrLoad("book-a", "guide", loadA);
    await cache.getOrLoad("book-b", "guide", loadB);

    await cache.invalidateNanobook("book-a");
    await cache.getOrLoad("book-a", "guide", loadA);
    await cache.getOrLoad("book-b", "guide", loadB);

    expect(loadA).toHaveBeenCalledTimes(2);
    expect(loadB).toHaveBeenCalledTimes(1);
  });

  it("returns an oversized source without storing its document entry", async () => {
    const runtime = runtimeCache();
    const cache = new VercelDocumentSourceCache(runtime);
    const large = document("large", "x".repeat(2 * 1024 * 1024));

    const result = await cache.getOrLoad("book-a", "large", async () => Result.ok(large));

    expect(result.getValue()).toBe(large);
    expect(runtime.set).not.toHaveBeenCalled();
  });
});
