import { Result } from "../../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { EditionStorageError, EditionWriterError } from "../domain/errors";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { DocumentWriter } from "./ports/DocumentWriter";

export type SaveDocumentError = EditionStorageError | EditionWriterError;

export class SaveDocument {
  constructor(
    private storage: DocumentStorage,
    private writer: DocumentWriter,
  ) {}

  async execute(documentId: string): Promise<Result<SaveDocumentError, SerializedEntry>> {
    const stageResult = this.storage.loadStagedDocument(documentId);
    if (!stageResult.isSuccess) {
      return Result.fail(stageResult.getError());
    }
    const staged = stageResult.getValue();
    if (!staged) return Result.fail(new Error("Staged document not found"));

    const writeResult = await this.writer.updateDocument(staged.documentId, staged);
    if (!writeResult.isSuccess) {
      return Result.fail(writeResult.getError());
    }
    const saved = writeResult.getValue();

    const currentStageResult = this.storage.loadStagedDocument(documentId);
    if (!currentStageResult.isSuccess) return Result.fail(currentStageResult.getError());
    if (!sameDocument(currentStageResult.getValue(), staged)) return Result.ok(staged);

    const stagedResult = this.storage.saveStagedDocument(documentId, saved);
    if (!stagedResult.isSuccess) return Result.fail(stagedResult.getError());
    const confirmationResult = this.storage.saveConfirmedDocument(documentId, saved);
    if (!confirmationResult.isSuccess) return Result.fail(confirmationResult.getError());
    return Result.ok(saved);
  }
}

function sameDocument(
  current: SerializedEntry | null,
  saved: SerializedEntry
): boolean {
  return JSON.stringify(current) === JSON.stringify(saved);
}
