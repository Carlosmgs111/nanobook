import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import { Result } from "../../shared/domain/Result";
import type { CachedPreview } from "../domain/model/StagedDocument";

export class GetRenderedDocument {
  constructor(private storage: DocumentStorage) {}
  execute(id: string, requireConfirmation = false): Result<Error, CachedPreview> {
    const cachedResult = this.storage.loadCachedPreview(id);
    if (!cachedResult.isSuccess) return Result.fail(cachedResult.getError());
    const cached = cachedResult.getValue();
    if (!cached) return Result.fail(new Error("Cached preview not found"));
    if ((cached.source.documentId ?? cached.source.id) !== id) {
      return Result.fail(new Error("Cached preview does not match the document"));
    }
    if (!requireConfirmation) return Result.ok(cached);

    const confirmedResult = this.storage.loadConfirmedDocument(id);
    if (!confirmedResult.isSuccess) return Result.fail(confirmedResult.getError());
    const confirmed = confirmedResult.getValue();
    if (!confirmed || JSON.stringify(cached.source) !== JSON.stringify(confirmed)) {
      return Result.fail(new Error("Cached preview does not match the confirmed document"));
    }
    return Result.ok(cached);
  }
}
