import type { Result } from "../../shared/domain/Result";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError } from "../domain/errors";

export type MarkDocumentSavedError = EditionStorageError;

export class MarkDocumentSaved {
  constructor(private storage: DocumentStorage) {}

  execute(): Result<MarkDocumentSavedError, void> {
    return this.storage.markSavedAt();
  }
}
