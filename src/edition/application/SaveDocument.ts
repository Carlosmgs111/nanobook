import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { EditionStorageError } from "../domain/errors";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { DocumentWriter } from "../application/ports/DocumentWriter";

export type SaveDocumentError = EditionStorageError | Error;

export class SaveDocument {
  constructor(
    private storage: DocumentStorage,
    private writer: DocumentWriter
  ) {}

  async execute(): Promise<Result<SaveDocumentError, SerializedEntry>> {
    const stageResult = this.storage.loadStagedDocument();
    if (!stageResult.isSuccess) {
      return Result.fail(stageResult.getError());
    }
    const staged = stageResult.getValue() as SerializedEntry;
    try {
      await this.writer.updateDocument(staged.id, staged);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new Error(message));
    }

    const saveResult = this.storage.saveStagedDocument(staged);
    if (!saveResult.isSuccess) return Result.fail(saveResult.getError());

    return Result.ok(staged);
  }
}
