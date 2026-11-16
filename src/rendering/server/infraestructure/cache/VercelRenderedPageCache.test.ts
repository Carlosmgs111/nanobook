import type { RuntimeCache } from "@vercel/functions";
import { describe, expect, it, vi } from "vitest";
import { VercelRenderedPageCache } from "./VercelRenderedPageCache";

function fakeRuntimeCache() {
  const store = new Map<string, unknown>();
  const tags = new Map<string, Set<string>>();
  const runtimeCache = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown, options?: { tags?: string[] }) => {
      store.set(key, value);
      for (const tag of options?.tags ?? []) tags.set(tag, (tags.get(tag) ?? new Set()).add(key));
    }),
    delete: vi.fn(async (key: string) => void store.delete(key)),
    expireTag: vi.fn(async (expired: string | string[]) => {
      for (const tag of [expired].flat()) {
        for (const key of tags.get(tag) ?? []) store.delete(key);
      }
    }),
  } satisfies RuntimeCache;
  return runtimeCache;
}

describe("VercelRenderedPageCache", () => {
  it("returns the HTML stored for the same page and content hash", async () => {
    const cache = new VercelRenderedPageCache(fakeRuntimeCache());

    await cache.set("doc", "hash-1", "<p>One</p>");

    expect((await cache.get("doc", "hash-1"))?.html).toBe("<p>One</p>");
    expect(await cache.get("doc", "hash-2")).toBeNull();
    expect(await cache.get("other", "hash-1")).toBeNull();
  });

  it("expires every stored version of a page through its tag", async () => {
    const runtimeCache = fakeRuntimeCache();
    const cache = new VercelRenderedPageCache(runtimeCache);
    await cache.set("doc", "hash-1", "<p>One</p>");
    await cache.set("doc", "hash-2", "<p>Two</p>");
    await cache.set("other", "hash-1", "<p>Other</p>");

    expect((await cache.invalidate(["doc"])).isSuccess).toBe(true);

    expect(runtimeCache.expireTag).toHaveBeenCalledWith(["page:doc"]);
    expect(await cache.get("doc", "hash-1")).toBeNull();
    expect(await cache.get("doc", "hash-2")).toBeNull();
    expect((await cache.get("other", "hash-1"))?.html).toBe("<p>Other</p>");
  });

  it("does not cache pages that exceed the runtime cache item limit", async () => {
    const runtimeCache = fakeRuntimeCache();

    await new VercelRenderedPageCache(runtimeCache).set("doc", "hash", "x".repeat(2 * 1024 * 1024));

    expect(runtimeCache.set).not.toHaveBeenCalled();
  });

  it("treats cache failures as a miss on read and reports them on invalidation", async () => {
    const runtimeCache = fakeRuntimeCache();
    runtimeCache.get.mockRejectedValue(new Error("down"));
    runtimeCache.set.mockRejectedValue(new Error("down"));
    runtimeCache.expireTag.mockRejectedValue(new Error("down"));
    const cache = new VercelRenderedPageCache(runtimeCache);

    expect(await cache.get("doc", "hash")).toBeNull();
    await expect(cache.set("doc", "hash", "<p>x</p>")).resolves.toBeUndefined();
    const result = await cache.invalidate(["doc"]);
    expect(result.isSuccess).toBe(false);
    expect(result.getError().name).toBe("PageCacheError");
  });
});
