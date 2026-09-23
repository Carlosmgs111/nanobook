import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import { Result } from "../../shared/domain/Result";
import type { CachedPreview } from "../domain/model/StagedDocument";

export class GetRenderedDocument {
  constructor(private storage: DocumentStorage) {}
  execute(id: string): Result<Error, CachedPreview> {
    const result = this.storage.loadCachedPreview();
    if (!result.isSuccess) return Result.fail(result.getError());
    const cached = result.getValue();
    if (!cached) return Result.fail(new Error("Cached preview not found"));
    return Result.ok(cached);
  }
}
