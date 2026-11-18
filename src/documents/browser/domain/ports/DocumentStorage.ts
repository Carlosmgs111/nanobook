import type { Result } from "../../../../shared/domain/Result";
import type { SerializedEntry, CachedPreview } from "../model/StagedDocument";
import type { EditionStorageError } from "../errors";

type StorageResult<T> = Result<EditionStorageError, T>;

export interface DocumentStorage {
  loadStagedDocument(documentId: string): StorageResult<SerializedEntry | null>;
  saveStagedDocument(documentId: string, document: SerializedEntry): StorageResult<void>;

  loadCachedPreview(documentId: string): StorageResult<CachedPreview | null>;
  saveCachedPreview(documentId: string, cached: CachedPreview): StorageResult<void>;

  loadConfirmedDocument(documentId: string): StorageResult<SerializedEntry | null>;
  saveConfirmedDocument(documentId: string, document: SerializedEntry): StorageResult<void>;
  clearConfirmedDocument(documentId: string): StorageResult<void>;

  /** Borra todo el estado local (staged, preview y confirmado) de un documento. */
  clearAll(documentId: string): StorageResult<void>;
}
