import { createClient } from "redis";
import type { RenderedPageCache } from "../../domain/cache";
import { FileSystemRenderedPageCache } from "./FileSystemRenderedPageCache";
import { InMemoryRenderedPageCache } from "./InMemoryRenderedPageCache";
import { RedisRenderedPageCache } from "./RedisRenderedPageCache";
import { CACHE_BACKEND, REDIS_URL } from "astro:env/server";

export type CacheBackend = "filesystem" | "memory" | "redis";

/**
 * Crea una implementación de RenderedPageCache según la configuración del
 * entorno. El backend por defecto es filesystem para mantener compatibilidad
 * con el comportamiento previo y con entornos de desarrollo local.
 */
const backend = CACHE_BACKEND || "filesystem";
const url = REDIS_URL;

export async function createRenderedPageCache(): Promise<RenderedPageCache> {
  switch (backend) {
    case "memory":
      return new InMemoryRenderedPageCache();
    case "redis":
      return createRedisRenderedPageCache();
    case "filesystem":
      return new FileSystemRenderedPageCache();
    default:
      throw new Error(`Unsupported cache backend: ${backend}`);
  }
}
async function createRedisRenderedPageCache(): Promise<RedisRenderedPageCache> {
  if (!url) {
    throw new Error("REDIS_URL is required when CACHE_BACKEND=redis");
  }

  const client = createClient({ url });
  return new RedisRenderedPageCache(client);
}
