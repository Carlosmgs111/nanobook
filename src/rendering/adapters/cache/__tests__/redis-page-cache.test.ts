import { describe, it, expect, beforeEach } from "vitest";
import { RedisRenderedPageCache } from "../redis-page-cache";

function createMockRedisClient() {
  const store = new Map<string, string>();
  let open = false;

  return {
    get isOpen() {
      return open;
    },
    connect: async () => {
      open = true;
      return undefined;
    },
    get: async (key: string) => {
      return store.get(key) ?? null;
    },
    set: async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    },
    del: async (keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.delete(key)) count++;
      }
      return count;
    },
  } as unknown as import("redis").RedisClientType;
}

describe("RedisRenderedPageCache", () => {
  let cache: RedisRenderedPageCache;
  let client: ReturnType<typeof createMockRedisClient>;

  beforeEach(() => {
    client = createMockRedisClient();
    cache = new RedisRenderedPageCache(client as unknown as import("redis").RedisClientType);
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

  it("conecta lazy al primer uso", async () => {
    expect(client.isOpen).toBe(false);
    await cache.set("doc", "hash-a", "<p>hello</p>");
    expect(client.isOpen).toBe(true);
  });
});
