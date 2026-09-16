import type { Result } from "../../shared/domain/Result";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { EditionStorageError } from "../domain/errors";

export type ClearEditionStorageError = EditionStorageError;

export class ClearEditionStorage {
  constructor(private storage: DocumentStorage) {}

  execute(): Result<ClearEditionStorageError, void> {
    return this.storage.clearAll();
  }
}
