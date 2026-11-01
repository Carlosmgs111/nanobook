import { Result } from "../../../../shared/domain/Result";
import type { DocumentSourceCache } from "../../application/DocumentSourceCache";
import type { Document } from "../../domain/Document";
import { fromDocumentSnapshot, toDocumentSnapshot, type DocumentSnapshot } from "../../domain/DocumentSnapshot";
import type { ContentRepositoryListError } from "../../domain/ports/ContentRepository";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import { UnifiedDocumentParser } from "../parse/DocumentParser";

export class InMemoryDocumentSourceCache implements DocumentSourceCache {
  private readonly versions = new Map<string, string>();
  private readonly entries = new Map<string, DocumentSnapshot>();

  constructor(private readonly parser: DocumentParser = new UnifiedDocumentParser()) {}

  async getOrLoad(nanobookId: string, publicPath: string, load: () => Promise<Result<ContentRepositoryListError, Document | null>>) {
    const version = this.versions.get(nanobookId) ?? crypto.randomUUID();
    this.versions.set(nanobookId, version);
    const key = `${nanobookId}:${version}:${publicPath}`;
    const snapshot = this.entries.get(key);
    if (snapshot) {
      const document = fromDocumentSnapshot(snapshot, this.parser);
      if (document) return Result.ok(document);
      this.entries.delete(key);
    }
    const loaded = await load();
    if (loaded.isSuccess && loaded.getValue()) this.entries.set(key, toDocumentSnapshot(loaded.getValue()));
    return loaded;
  }

  async invalidateNanobook(nanobookId: string): Promise<void> {
    this.versions.set(nanobookId, crypto.randomUUID());
  }
}
