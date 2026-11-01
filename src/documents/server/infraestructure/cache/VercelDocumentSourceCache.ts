import { getCache, type RuntimeCache } from "@vercel/functions";
import { Result } from "../../../../shared/domain/Result";
import type { DocumentSourceCache } from "../../application/DocumentSourceCache";
import type { Document } from "../../domain/Document";
import { fromDocumentSnapshot, toDocumentSnapshot } from "../../domain/DocumentSnapshot";
import type { ContentRepositoryListError } from "../../domain/ports/ContentRepository";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import { UnifiedDocumentParser } from "../parse/DocumentParser";

const CACHE_TTL_SECONDS = 300;
const MAX_ITEM_BYTES = 2 * 1024 * 1024;

export class VercelDocumentSourceCache implements DocumentSourceCache {
  constructor(
    private readonly runtimeCache: RuntimeCache = getCache({
      namespace: "document:v1",
      namespaceSeparator: ":",
    }),
    private readonly parser: DocumentParser = new UnifiedDocumentParser(),
  ) {}

  async getOrLoad(
    nanobookId: string,
    publicPath: string,
    load: () => Promise<Result<ContentRepositoryListError, Document | null>>,
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const version = await this.getVersion(nanobookId);
    if (version) {
      const key = this.documentKey(nanobookId, version, publicPath);
      const cached = await this.read(key);
      if (cached) return Result.ok(cached);

      const loaded = await load();
      if (loaded.isSuccess && loaded.getValue()) await this.store(key, loaded.getValue());
      return loaded;
    }
    return load();
  }

  invalidateNanobook(nanobookId: string): Promise<void> {
    return this.runtimeCache.set(this.versionKey(nanobookId), crypto.randomUUID(), {
      name: `document-version:${nanobookId}`,
      ttl: CACHE_TTL_SECONDS,
    });
  }

  private async getVersion(nanobookId: string): Promise<string | null> {
    const key = this.versionKey(nanobookId);
    try {
      const cached = await this.runtimeCache.get(key);
      if (typeof cached === "string" && cached) return cached;
      const version = crypto.randomUUID();
      await this.runtimeCache.set(key, version, {
        name: `document-version:${nanobookId}`,
        ttl: CACHE_TTL_SECONDS,
      });
      return version;
    } catch {
      return null;
    }
  }

  private async read(key: string): Promise<Document | null> {
    try {
      const snapshot = await this.runtimeCache.get(key);
      if (snapshot === null) return null;
      const document = fromDocumentSnapshot(snapshot, this.parser);
      if (document) return document;
      await this.runtimeCache.delete(key);
    } catch {
      return null;
    }
    return null;
  }

  private async store(key: string, document: Document): Promise<void> {
    const snapshot = toDocumentSnapshot(document);
    if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength >= MAX_ITEM_BYTES) return;
    try {
      await this.runtimeCache.set(key, snapshot, {
        name: `document:${document.getDocumentId().getValue()}`,
        ttl: CACHE_TTL_SECONDS,
      });
    } catch {
      // Runtime Cache is optional for reads; return the source result instead.
    }
  }

  private versionKey(nanobookId: string): string {
    return `version:${nanobookId}`;
  }

  private documentKey(nanobookId: string, version: string, path: string): string {
    return `${nanobookId}:${version}:${path.trim().replace(/^\/+|\/+$/g, "")}`;
  }
}
