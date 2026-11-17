import type { NanobookReadCache } from "../../domain/ports/NanobookReadCache";
import { InMemoryNanobookReadCache } from "./InMemoryNanobookReadCache";
import { VercelNanobookReadCache } from "./VercelNanobookReadCache";

export function createNanobookReadCache(
  environment: NodeJS.ProcessEnv = process.env,
): NanobookReadCache {
  return environment.VERCEL === "1"
    ? new VercelNanobookReadCache()
    : new InMemoryNanobookReadCache();
}
