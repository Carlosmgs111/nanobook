import type { RuntimeCache } from "@vercel/functions";
import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { VercelDocumentSourceCache } from "./VercelDocumentSourceCache";

function runtimeCache(): RuntimeCache {
  const values = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => void values.set(key, value)),
    delete: vi.fn(async (key: string) => void values.delete(key)),
    expireTag: vi.fn(async () => undefined),
  };
}

function document(path = "guide") {
  return Document.create(path, {
    id: "doc-1", title: "Guide", description: "Guide",
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt: new Date("2026-11-01T12:00:00.000Z"),
  }, "# Guide").getValue();
}

describe("VercelDocumentSourceCache", () => {
  it("uses the same versioned source entry until a document event changes the nanobook version", async () => {
    const runtime = runtimeCache();
    const cache = new VercelDocumentSourceCache(runtime);
    const load = vi.fn(async () => Result.ok(document()));

    await cache.getOrLoad("book-a", "guide", load);
    await cache.getOrLoad("book-a", "guide", load);
    await cache.invalidateNanobook("book-a");
    await cache.getOrLoad("book-a", "guide", load);

    expect(load).toHaveBeenCalledTimes(2);
    expect(runtime.set).toHaveBeenCalledWith(
      expect.stringMatching(/^book-a:[^:]+:guide$/),
      expect.any(Object),
      expect.objectContaining({ ttl: 300 }),
    );
  });

  it("returns an oversized source without storing its document entry", async () => {
    const runtime = runtimeCache();
    const cache = new VercelDocumentSourceCache(runtime);
    const large = Document.create("large", {
      id: "large", title: "Large", description: "Large",
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      updatedAt: new Date("2026-11-01T12:00:00.000Z"),
    }, "x".repeat(2 * 1024 * 1024)).getValue();

    const result = await cache.getOrLoad("book-a", "large", async () => Result.ok(large));

    expect(result.getValue()).toBe(large);
    expect(runtime.set).not.toHaveBeenCalledWith(
      expect.stringMatching(/:large$/), expect.anything(), expect.anything(),
    );
  });
});
