import type { Result } from "../../../shared/domain/Result";
import type { SerializedEntry } from "../model/StagedDocument";
import type { CachedPreview } from "../model/StagedDocument";
import type { EditionStorageError } from "../errors";

export interface DocumentStorage {
  loadStagedDocument(documentId: string): Result<EditionStorageError, SerializedEntry | null>;
  saveStagedDocument(document: SerializedEntry): Result<EditionStorageError, void>;
  clearStagedDocument(documentId: string): Result<EditionStorageError, void>;

  loadCachedPreview(documentId: string): Result<EditionStorageError, CachedPreview | null>;
  saveCachedPreview(cached: CachedPreview): Result<EditionStorageError, void>;
  clearCachedPreview(documentId: string): Result<EditionStorageError, void>;

  loadConfirmedDocument(documentId: string): Result<EditionStorageError, SerializedEntry | null>;
  saveConfirmedDocument(document: SerializedEntry): Result<EditionStorageError, void>;
  clearConfirmedDocument(documentId: string): Result<EditionStorageError, void>;

  clearAll(documentId?: string): Result<EditionStorageError, void>;
}
