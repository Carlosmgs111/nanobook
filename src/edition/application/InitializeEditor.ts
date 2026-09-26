import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError } from "../domain/errors";

export class InitializeEditor {
  constructor(private storage: DocumentStorage) {}

  execute(base: SerializedEntry): Result<EditionStorageError, SerializedEntry | null> {
    const documentId = base.documentId ?? base.id;
    const stagedResult = this.storage.loadStagedDocument(documentId);
    if (!stagedResult.isSuccess) {
      return Result.fail(stagedResult.getError());
    }

    const staged = stagedResult.getValue();
    if (!staged) {
      const saveResult = this.storage.saveStagedDocument(documentId, base);
      if (!saveResult.isSuccess) return Result.fail(saveResult.getError());
      return Result.ok(base);
    }

    return Result.ok(staged);
  }
}
