import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRenderedPageCache } from "../memory-page-cache";

describe("MemoryRenderedPageCache", () => {
  let cache: MemoryRenderedPageCache;

  beforeEach(() => {
    cache = new MemoryRenderedPageCache();
  });

  it("devuelve null cuando no hay cache", async () => {
    const result = await cache.get("doc", "hash-a");
    expect(result).toBeNull();
  });

  it("almacena y recupera una página renderizada", async () => {
    await cache.set("doc", "hash-a", "<p>hello</p>");

    const result = await cache.get("doc", "hash-a");
    expect(result).not.toBeNull();
    expect(result?.pageId).toBe("doc");
    expect(result?.contentHash).toBe("hash-a");
    expect(result?.html).toBe("<p>hello</p>");
  });

  it("devuelve null cuando el hash no coincide", async () => {
    await cache.set("doc", "hash-a", "<p>hello</p>");

    const result = await cache.get("doc", "hash-b");
    expect(result).toBeNull();
  });

  it("invalida páginas eliminando entradas", async () => {
    await cache.set("doc", "hash-a", "<p>hello</p>");

    await cache.invalidate(["doc"]);

    const result = await cache.get("doc", "hash-a");
    expect(result).toBeNull();
  });

  it("expone el tamaño del cache", async () => {
    expect(cache.size()).toBe(0);
    await cache.set("doc", "hash-a", "<p>hello</p>");
    expect(cache.size()).toBe(1);
  });
});
