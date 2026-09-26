import { Result } from "../../../shared/domain/Result";
import type { DocumentStorage } from "../../domain/ports/DocumentStorage";
import type { SerializedEntry, CachedPreview } from "../../domain/model/StagedDocument";
import { EditionStorageError } from "../../domain/errors";

const KEY_PREFIX = "nanobook:edition";

function key(kind: "staged" | "preview" | "confirmed", documentId: string): string {
  const key = `${KEY_PREFIX}:${encodeURIComponent(documentId)}:${kind}`;
  console.log({ key })
  return key;
}

function read<T>(storage: Storage, key: string): Result<EditionStorageError, T | null> {
  try {
    const raw = storage.getItem(key);
    return Result.ok(raw ? (JSON.parse(raw) as T) : null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Result.fail(new EditionStorageError(`Failed to read "${key}": ${message}`));
  }
}

function write(
  storage: Storage,
  key: string,
  value: unknown
): Result<EditionStorageError, void> {
  try {
    storage.setItem(key, JSON.stringify(value));
    return Result.ok();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Result.fail(new EditionStorageError(`Failed to write "${key}": ${message}`));
  }
}

function remove(storage: Storage, key: string): Result<EditionStorageError, void> {
  try {
    storage.removeItem(key);
    return Result.ok();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Result.fail(new EditionStorageError(`Failed to remove "${key}": ${message}`));
  }
}

export class SessionStorageDocumentStorage implements DocumentStorage {
  constructor(private storage: Storage = globalThis.sessionStorage) {}

  loadStagedDocument(documentId: string): Result<EditionStorageError, SerializedEntry | null> {
    return read<SerializedEntry>(this.storage, key("staged", documentId));
  }

  saveStagedDocument(documentId: string, document: SerializedEntry): Result<EditionStorageError, void> {
    return write(this.storage, key("staged", documentId), document);
  }

  clearStagedDocument(documentId: string): Result<EditionStorageError, void> {
    return remove(this.storage, key("staged", documentId));
  }

  loadCachedPreview(documentId: string): Result<EditionStorageError, CachedPreview | null> {
    return read<CachedPreview>(this.storage, key("preview", documentId));
  }

  saveCachedPreview(documentId: string, cached: CachedPreview): Result<EditionStorageError, void> {
    return write(this.storage, key("preview", documentId), cached);
  }

  clearCachedPreview(documentId: string): Result<EditionStorageError, void> {
    return remove(this.storage, key("preview", documentId));
  }

  loadConfirmedDocument(documentId: string): Result<EditionStorageError, SerializedEntry | null> {
    return read<SerializedEntry>(this.storage, key("confirmed", documentId));
  }

  saveConfirmedDocument(documentId: string, document: SerializedEntry): Result<EditionStorageError, void> {
    return write(this.storage, key("confirmed", documentId), document);
  }

  clearConfirmedDocument(documentId: string): Result<EditionStorageError, void> {
    return remove(this.storage, key("confirmed", documentId));
  }

  clearAll(documentId?: string): Result<EditionStorageError, void> {
    if (!documentId) return Result.ok();
    const results: Result<EditionStorageError, void>[] = [
      this.clearStagedDocument(documentId),
      this.clearCachedPreview(documentId),
      this.clearConfirmedDocument(documentId),
    ];
    for (const result of results) {
      if (!result.isSuccess) return result;
    }
    return Result.ok();
  }
}
