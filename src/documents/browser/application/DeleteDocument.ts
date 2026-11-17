import { Result } from "../../../shared/domain/Result";
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
    const deleteResult = await this.writer.deleteDocument(documentId);
    if (!deleteResult.isSuccess) return Result.fail(deleteResult.getError());

    return this.storage.clearAll(documentId);
  }
}
