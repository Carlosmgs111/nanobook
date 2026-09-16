import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError } from "../domain/errors";

export type StageDocumentError = EditionStorageError;

export class StageDocument {
  constructor(private storage: DocumentStorage) {}

  execute(document: SerializedEntry): Result<StageDocumentError, void> {
    const saveResult = this.storage.saveStagedDocument(document);
    if (!saveResult.isSuccess) return saveResult;

    const clearSavedAtResult = this.storage.clearSavedAt();
    if (!clearSavedAtResult.isSuccess) return clearSavedAtResult;

    return Result.ok();
  }
}
