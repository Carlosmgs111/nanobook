import type { RenderedPageCache } from "../../model/types";
import { FileSystemRenderedPageCache } from "./file-system-page-cache";
import { MemoryRenderedPageCache } from "./memory-page-cache";

export type CacheBackend = "filesystem" | "memory";

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
    case "filesystem":
      return new FileSystemRenderedPageCache();
    default:
      throw new Error(`Unsupported cache backend: ${backend}`);
  }
}

function getConfiguredBackend(): CacheBackend {
  const env = process.env.CACHE_BACKEND;

  if (env === "memory" || env === "filesystem") {
    return env;
  }

  return "filesystem";
}
