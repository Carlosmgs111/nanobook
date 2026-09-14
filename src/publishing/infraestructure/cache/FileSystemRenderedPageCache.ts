import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Result } from "../../../shared/domain/Result";
import type { CachedPage, RenderedPageCache } from "../../domain/cache";
import { PageCacheError } from "../errors";

function hashPageId(pageId: string): string {
  return createHash("sha256").update(pageId).digest("hex");
}

/**
 * Cache de páginas renderizadas en filesystem.
 *
 * Cada entrada se almacena como JSON en `.nanobook/cache/pages/` usando un
 * hash del `pageId` como nombre de archivo. La clave de validez es el
 * `contentHash` del documento.
 */
export class FileSystemRenderedPageCache implements RenderedPageCache {
  constructor(private cacheDir: string = "./.nanobook/cache/pages") {}

  private cacheFilePath(pageId: string): string {
    return join(this.cacheDir, `${hashPageId(pageId)}.json`);
  }

  async get(pageId: string, contentHash: string): Promise<CachedPage | null> {
    const filePath = this.cacheFilePath(pageId);
    if (!existsSync(filePath)) return null;

    try {
      const raw = await readFile(filePath, "utf-8");
      const cached = JSON.parse(raw) as CachedPage;
      if (cached.contentHash !== contentHash) return null;
      return cached;
    } catch {
      return null;
    }
  }

  async set(
    pageId: string,
    contentHash: string,
    html: string,
  ): Promise<void> {
    const filePath = this.cacheFilePath(pageId);
    await mkdir(dirname(filePath), { recursive: true });

    const cached: CachedPage = {
      pageId,
      contentHash,
      html,
      renderedAt: new Date().toISOString(),
    };

    await writeFile(filePath, JSON.stringify(cached, null, 2), "utf-8");
  }

  async invalidate(pageIds: string[]): Promise<Result<PageCacheError, void>> {
    try {
      for (const pageId of pageIds) {
        const filePath = this.cacheFilePath(pageId);
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      }
      return Result.ok();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(
        new PageCacheError(`Failed to invalidate cache entries: ${message}`, {
          cause: error,
        })
      );
    }
  }
}
