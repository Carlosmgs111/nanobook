import { describe, it, expect, beforeEach } from "vitest";
import { FileSystemRenderedPageCache } from "../../adapters/cache/file-system-page-cache";
import { rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const TEST_CACHE_DIR = join(process.cwd(), ".nanobook", "cache", "test-pages");

describe("FileSystemRenderedPageCache", () => {
  beforeEach(async () => {
    if (existsSync(TEST_CACHE_DIR)) {
      await rm(TEST_CACHE_DIR, { recursive: true, force: true });
    }
    await mkdir(TEST_CACHE_DIR, { recursive: true });
  });

  it("devuelve null cuando no hay cache", async () => {
    const cache = new FileSystemRenderedPageCache(TEST_CACHE_DIR);
    const result = await cache.get("doc", "hash-a");
    expect(result).toBeNull();
  });

  it("almacena y recupera una página renderizada", async () => {
    const cache = new FileSystemRenderedPageCache(TEST_CACHE_DIR);
    await cache.set("doc", "hash-a", "<p>hello</p>");

    const result = await cache.get("doc", "hash-a");
    expect(result).not.toBeNull();
    expect(result?.pageId).toBe("doc");
    expect(result?.contentHash).toBe("hash-a");
    expect(result?.html).toBe("<p>hello</p>");
  });

  it("devuelve null cuando el hash no coincide", async () => {
    const cache = new FileSystemRenderedPageCache(TEST_CACHE_DIR);
    await cache.set("doc", "hash-a", "<p>hello</p>");

    const result = await cache.get("doc", "hash-b");
    expect(result).toBeNull();
  });

  it("invalida páginas eliminando archivos", async () => {
    const cache = new FileSystemRenderedPageCache(TEST_CACHE_DIR);
    await cache.set("doc", "hash-a", "<p>hello</p>");

    await cache.invalidate(["doc"]);

    const result = await cache.get("doc", "hash-a");
    expect(result).toBeNull();
  });
});
