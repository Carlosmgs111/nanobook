import type { RuntimeCache } from "@vercel/functions";
import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Nanobook } from "../../domain/Nanobook";
import { toNanobookSnapshot } from "../../domain/NanobookSnapshot";
import { VercelNanobookReadCache } from "./VercelNanobookReadCache";

function createRuntimeCache(entries: Record<string, unknown> = {}): RuntimeCache {
  const values = new Map(Object.entries(entries));
  return {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => {
      values.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    expireTag: vi.fn(async () => undefined),
  };
}

function book() {
  return Nanobook.create({
    id: "book-1",
    ownerId: "owner-1",
    slug: "manual",
    name: "Manual",
    visibility: "public",
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
  }).getValue();
}

describe("VercelNanobookReadCache", () => {
  it("returns a cached nanobook for a normalized slug without loading LibSQL", async () => {
    const runtimeCache = createRuntimeCache({
      "slug:manual": toNanobookSnapshot(book()),
    });
    const cache = new VercelNanobookReadCache(runtimeCache);
    const load = vi.fn(async () => Result.ok(null));

    const result = await cache.getOrLoad(" Manual ", load);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()?.toPersistence()).toEqual(book().toPersistence());
    expect(load).not.toHaveBeenCalled();
  });

  it("drops a corrupt entry and refills it with the repository result", async () => {
    const runtimeCache = createRuntimeCache({ "slug:manual": { id: "broken" } });
    const cache = new VercelNanobookReadCache(runtimeCache);
    const load = vi.fn(async () => Result.ok(book()));

    const result = await cache.getOrLoad("manual", load);

    expect(result.getValue()?.getId()).toBe("book-1");
    expect(load).toHaveBeenCalledOnce();
    expect(runtimeCache.delete).toHaveBeenCalledWith("slug:manual");
    expect(runtimeCache.set).toHaveBeenCalledWith(
      "slug:manual",
      toNanobookSnapshot(book()),
      expect.objectContaining({ name: "nanobook:manual", ttl: 300 }),
    );
  });

  it("replaces a renamed snapshot and removes its previous slug", async () => {
    const runtimeCache = createRuntimeCache();
    const cache = new VercelNanobookReadCache(runtimeCache);
    const renamed = Nanobook.create({
      ...book().toPersistence(),
      slug: "guide",
      updatedAt: new Date("2026-11-01T13:00:00.000Z"),
    }).getValue();

    await cache.replace(renamed, "manual");

    expect(runtimeCache.delete).toHaveBeenCalledWith("slug:manual");
    expect(runtimeCache.set).toHaveBeenCalledWith(
      "slug:guide",
      toNanobookSnapshot(renamed),
      expect.objectContaining({ name: "nanobook:guide", ttl: 300 }),
    );
  });
});
