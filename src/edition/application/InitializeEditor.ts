import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError } from "../domain/errors";

export class InitializeEditor {
  constructor(private storage: DocumentStorage) {}

  execute(base: SerializedEntry): Result<EditionStorageError, SerializedEntry | null> {
    const documentId = base.documentId;
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

    const confirmedResult = this.storage.loadConfirmedDocument(documentId);
    if (!confirmedResult.isSuccess) {
      return Result.fail(confirmedResult.getError());
    }

    const confirmed = confirmedResult.getValue();
    if (
      confirmed &&
      sameDocument(staged, confirmed) &&
      !sameDocument(staged, base)
    ) {
      const saveResult = this.storage.saveStagedDocument(documentId, base);
      if (!saveResult.isSuccess) return Result.fail(saveResult.getError());
      return Result.ok(base);
    }

    return Result.ok(staged);
  }
}

function sameDocument(
  left: SerializedEntry,
  right: SerializedEntry
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
