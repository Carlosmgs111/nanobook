import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError } from "../domain/errors";

export class InitializeEditor {
  constructor(
    private storage: DocumentStorage,
  ) {}

  execute(base: SerializedEntry): Result<EditionStorageError, void> {
    const stagedResult = this.storage.loadStagedDocument();
    if (!stagedResult.isSuccess) {
      return Result.fail(stagedResult.getError());
    }

    const staged = stagedResult.getValue();
    if (staged && staged.id !== base.id) {
      return this.storage.clearAll();
    }

    if (!staged) {
      const saveResult = this.storage.saveStagedDocument(base);
      if (!saveResult.isSuccess) return saveResult;

      const clearSavedAtResult = this.storage.clearSavedAt();
      if (!clearSavedAtResult.isSuccess) return clearSavedAtResult;
    }

    return Result.ok();
  }
}
