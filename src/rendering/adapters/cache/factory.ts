import { createClient } from "redis";
import type { RenderedPageCache } from "../../model/types";
import { FileSystemRenderedPageCache } from "./file-system-page-cache";
import { MemoryRenderedPageCache } from "./memory-page-cache";
import { RedisRenderedPageCache } from "./redis-page-cache";

export type CacheBackend = "filesystem" | "memory" | "redis";

/**
 * Crea una implementación de RenderedPageCache según la configuración del
 * entorno. El backend por defecto es filesystem para mantener compatibilidad
 * con el comportamiento previo y con entornos de desarrollo local.
 */
export function createRenderedPageCache(
  backend: CacheBackend = getConfiguredBackend(),
): RenderedPageCache {
  switch (backend) {
    case "memory":
      return new MemoryRenderedPageCache();
    case "redis":
      return createRedisRenderedPageCache();
    case "filesystem":
      return new FileSystemRenderedPageCache();
    default:
      throw new Error(`Unsupported cache backend: ${backend}`);
  }
}

function getConfiguredBackend(): CacheBackend {
  const env = process.env.CACHE_BACKEND;

  if (env === "memory" || env === "filesystem" || env === "redis") {
    return env;
  }

  return "filesystem";
}

function createRedisRenderedPageCache(): RedisRenderedPageCache {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is required when CACHE_BACKEND=redis",
    );
  }

  const client = createClient({ url });
  return new RedisRenderedPageCache(client);
}
