import type { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError } from "../domain/errors";

export type LoadStagedDocumentError = EditionStorageError;

export class LoadStagedDocument {
  constructor(private storage: DocumentStorage) {}

  execute(): Result<LoadStagedDocumentError, SerializedEntry | null> {
    return this.storage.loadStagedDocument();
  }
}
