import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

const CACHE_DIR = "./.nanobook/cache/github";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function cacheFilePath(key: string): string {
  const hashed = hashKey(key);
  return join(CACHE_DIR, `${hashed}.json`);
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export async function getCached<T>(
  key: string,
  ttlMs: number
): Promise<T | null> {
  const path = cacheFilePath(key);
  if (!existsSync(path)) return null;

  try {
    const raw = await readFile(path, "utf-8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.expiresAt < Date.now()) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export async function setCached<T>(
  key: string,
  data: T,
  ttlMs: number
): Promise<void> {
  const path = cacheFilePath(key);
  await mkdir(dirname(path), { recursive: true });
  const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
  await writeFile(path, JSON.stringify(entry), "utf-8");
}

export function buildCacheKey(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(":");
}

export function clearCached(key: string): void {
  const path = cacheFilePath(key);
  if (existsSync(path)) {
    // Fire-and-forget deletion; failures are not critical.
    import("node:fs/promises")
      .then(({ unlink }) => unlink(path))
      .catch(() => {});
  }
}
