import { getCache, type RuntimeCache } from "@vercel/functions";
import { Result } from "../../../../shared/domain/Result";
import type { DocumentSourceCache } from "../../application/DocumentSourceCache";
import type { Document } from "../../domain/Document";
import { fromDocumentSnapshot, toDocumentSnapshot } from "../../domain/DocumentSnapshot";
import type { ContentRepositoryListError } from "../../domain/ports/ContentRepository";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import { UnifiedDocumentParser } from "../parse/DocumentParser";

/** Tope de seguridad: la invalidación real la hace la etiqueta del nanobook, no el tiempo. */
const CACHE_TTL_SECONDS = 3600;
const MAX_ITEM_BYTES = 2 * 1024 * 1024;

const nanobookTag = (nanobookId: string) => `nanobook:${nanobookId}`;

/**
 * Caché de fuentes de documento sobre la Runtime Cache de Vercel.
 *
 * Cada documento se guarda bajo `nanobookId:publicPath` y se etiqueta con su nanobook, así que
 * leer cuesta una sola consulta a la caché y un fallo, una lectura más y una escritura.
 * Invalidar un nanobook expira su etiqueta y todos sus documentos caducan juntos.
 */
export class VercelDocumentSourceCache implements DocumentSourceCache {
  constructor(
    private readonly runtimeCache: RuntimeCache = getCache({
      namespace: "document:v2",
      namespaceSeparator: ":",
    }),
    private readonly parser: DocumentParser = new UnifiedDocumentParser(),
  ) {}

  async getOrLoad(
    nanobookId: string,
    publicPath: string,
    load: () => Promise<Result<ContentRepositoryListError, Document | null>>,
  ): Promise<Result<ContentRepositoryListError, Document | null>> {
    const key = this.documentKey(nanobookId, publicPath);
    const cached = await this.read(key);
    if (cached) return Result.ok(cached);

    const loaded = await load();
    if (loaded.isSuccess && loaded.getValue()) await this.store(nanobookId, key, loaded.getValue());
    return loaded;
  }

  async invalidateNanobook(nanobookId: string): Promise<void> {
    await this.runtimeCache.expireTag(nanobookTag(nanobookId));
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

  private async store(nanobookId: string, key: string, document: Document): Promise<void> {
    const snapshot = toDocumentSnapshot(document);
    if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength >= MAX_ITEM_BYTES) return;
    try {
      await this.runtimeCache.set(key, snapshot, {
        name: `document:${document.getDocumentId().getValue()}`,
        tags: [nanobookTag(nanobookId)],
        ttl: CACHE_TTL_SECONDS,
      });
    } catch {
      // Runtime Cache is optional for reads; return the source result instead.
    }
  }

  private documentKey(nanobookId: string, path: string): string {
    return `${nanobookId}:${path}`;
  }
}
