import { Result } from "../../../shared/domain/Result";
import type { DocumentStorage } from "../../domain/ports/DocumentStorage";
import type { SerializedEntry, CachedPreview } from "../../domain/model/StagedDocument";
import { EditionStorageError } from "../../domain/errors";

const STAGED_KEY = "stagedDocument";
const CACHED_PREVIEW_KEY = "cachedPreview";

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

  loadStagedDocument(): Result<EditionStorageError, SerializedEntry | null> {
    return read<SerializedEntry>(this.storage, STAGED_KEY);
  }

  saveStagedDocument(document: SerializedEntry): Result<EditionStorageError, void> {
    return write(this.storage, STAGED_KEY, document);
  }

  clearStagedDocument(): Result<EditionStorageError, void> {
    return remove(this.storage, STAGED_KEY);
  }

  loadCachedPreview(): Result<EditionStorageError, CachedPreview | null> {
    return read<CachedPreview>(this.storage, CACHED_PREVIEW_KEY);
  }

  saveCachedPreview(cached: CachedPreview): Result<EditionStorageError, void> {
    return write(this.storage, CACHED_PREVIEW_KEY, cached);
  }

  clearCachedPreview(): Result<EditionStorageError, void> {
    return remove(this.storage, CACHED_PREVIEW_KEY);
  }

  clearAll(): Result<EditionStorageError, void> {
    const results: Result<EditionStorageError, void>[] = [
      this.clearStagedDocument(),
      this.clearCachedPreview(),
    ];
    for (const result of results) {
      if (!result.isSuccess) return result;
    }
    return Result.ok();
  }
}
