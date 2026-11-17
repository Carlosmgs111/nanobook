import { Result } from "../../../shared/domain/Result";
import { sameDocument, type SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError } from "../domain/errors";

export class InitializeEditor {
  constructor(private storage: DocumentStorage) {}

  /**
   * Devuelve el borrador a editar: el staged si existe, o la base del servidor
   * cuando no hay borrador o el borrador ya estaba guardado y el servidor avanzó.
   */
  execute(base: SerializedEntry): Result<EditionStorageError, SerializedEntry> {
    const documentId = base.documentId;
    const stagedResult = this.storage.loadStagedDocument(documentId);
    if (!stagedResult.isSuccess) return Result.fail(stagedResult.getError());
    const staged = stagedResult.getValue();

    if (staged) {
      const confirmedResult = this.storage.loadConfirmedDocument(documentId);
      if (!confirmedResult.isSuccess) return Result.fail(confirmedResult.getError());
      const confirmed = confirmedResult.getValue();
      const serverMovedOn =
        confirmed && sameDocument(staged, confirmed) && !sameDocument(staged, base);
      if (!serverMovedOn) return Result.ok(staged);
    }

    const saveResult = this.storage.saveStagedDocument(documentId, base);
    if (!saveResult.isSuccess) return Result.fail(saveResult.getError());
    return Result.ok(base);
  }
}
