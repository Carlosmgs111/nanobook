import type { Result } from "../../../shared/domain/Result";
import type { SerializedEntry } from "../model/StagedDocument";
import type { RenderedPreview } from "../model/StagedDocument";
import type { EditionStorageError } from "../errors";

export interface DocumentStorage {
  loadStagedDocument(): Result<EditionStorageError, SerializedEntry | null>;
  saveStagedDocument(document: SerializedEntry): Result<EditionStorageError, void>;
  clearStagedDocument(): Result<EditionStorageError, void>;

  loadRenderedDocument(): Result<EditionStorageError, RenderedPreview | null>;
  saveRenderedDocument(rendered: RenderedPreview): Result<EditionStorageError, void>;
  clearRenderedDocument(): Result<EditionStorageError, void>;

  loadRenderedSource(): Result<EditionStorageError, SerializedEntry | null>;
  saveRenderedSource(source: SerializedEntry): Result<EditionStorageError, void>;

  loadPendingDocument(): Result<EditionStorageError, SerializedEntry | null>;
  savePendingDocument(document: SerializedEntry): Result<EditionStorageError, void>;
  clearPendingDocument(): Result<EditionStorageError, void>;

  loadSavedAt(): Result<EditionStorageError, number | null>;
  markSavedAt(): Result<EditionStorageError, void>;
  clearSavedAt(): Result<EditionStorageError, void>;

  clearAll(): Result<EditionStorageError, void>;
}
