import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError, EditionWriterError } from "../domain/errors";
import type { DocumentWriter } from "./ports/DocumentWriter";

export type DeleteDocumentError = EditionStorageError | EditionWriterError;

export class DeleteDocument {
  constructor(
    private storage: DocumentStorage,
    private writer: DocumentWriter
  ) {}

  async execute(documentId: string): Promise<Result<DeleteDocumentError, void>> {
    const stagedResult = this.storage.loadStagedDocument(documentId);
    if (!stagedResult.isSuccess) return Result.fail(stagedResult.getError());
    const staged = stagedResult.getValue();
    if (!staged) return Result.fail(new Error("Staged document not found"));

    const deleteResult = await this.writer.deleteDocument(staged.documentId);
    if (!deleteResult.isSuccess) return Result.fail(deleteResult.getError());

    return this.storage.clearAll(documentId);
  }
}
