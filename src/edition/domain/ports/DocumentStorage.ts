import type { Result } from "../../../shared/domain/Result";
import type { SerializedEntry } from "../model/StagedDocument";
import type { CachedPreview } from "../model/StagedDocument";
import type { EditionStorageError } from "../errors";

export interface DocumentStorage {
  loadStagedDocument(): Result<EditionStorageError, SerializedEntry | null>;
  saveStagedDocument(document: SerializedEntry): Result<EditionStorageError, void>;
  clearStagedDocument(): Result<EditionStorageError, void>;

  loadCachedPreview(): Result<EditionStorageError, CachedPreview | null>;
  saveCachedPreview(cached: CachedPreview): Result<EditionStorageError, void>;
  clearCachedPreview(): Result<EditionStorageError, void>;

  clearAll(): Result<EditionStorageError, void>;
}
