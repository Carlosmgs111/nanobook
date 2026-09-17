import { Result } from "../../../shared/domain/Result";
import type { DocumentStorage } from "../../domain/ports/DocumentStorage";
import type { SerializedEntry, RenderedPreview } from "../../domain/model/StagedDocument";
import { EditionStorageError } from "../../domain/errors";

const STAGED_KEY = "stagedDocument";
const RENDERED_KEY = "renderedStagedDocument";
const RENDERED_SOURCE_KEY = "renderedStagedDocumentSource";
const PENDING_KEY = "renderPendingDocument";
const SAVED_AT_KEY = "stagedDocumentSavedAt";

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

  loadRenderedDocument(): Result<EditionStorageError, RenderedPreview | null> {
    return read<RenderedPreview>(this.storage, RENDERED_KEY);
  }

  saveRenderedDocument(rendered: RenderedPreview): Result<EditionStorageError, void> {
    return write(this.storage, RENDERED_KEY, rendered);
  }

  clearRenderedDocument(): Result<EditionStorageError, void> {
    return remove(this.storage, RENDERED_KEY);
  }

  loadRenderedSource(): Result<EditionStorageError, SerializedEntry | null> {
    return read<SerializedEntry>(this.storage, RENDERED_SOURCE_KEY);
  }

  saveRenderedSource(source: SerializedEntry): Result<EditionStorageError, void> {
    return write(this.storage, RENDERED_SOURCE_KEY, source);
  }

  loadPendingDocument(): Result<EditionStorageError, SerializedEntry | null> {
    return read<SerializedEntry>(this.storage, PENDING_KEY);
  }

  savePendingDocument(document: SerializedEntry): Result<EditionStorageError, void> {
    return write(this.storage, PENDING_KEY, document);
  }

  clearPendingDocument(): Result<EditionStorageError, void> {
    return remove(this.storage, PENDING_KEY);
  }

  loadSavedAt(): Result<EditionStorageError, number | null> {
    const result = read<string>(this.storage, SAVED_AT_KEY);
    if (!result.isSuccess) return Result.fail(result.getError());
    const raw = result.getValue();
    if (!raw) return Result.ok(null);
    const value = Number(raw);
    return Result.ok(Number.isNaN(value) ? null : value);
  }

  getRawDocumentContent(base: SerializedEntry): Result<EditionStorageError, string | null> {
    const stagedResult = this.storage.loadStagedDocument();
    if (!stagedResult.isSuccess) {
      return Result.fail(stagedResult.getError());
    }

    const staged = stagedResult.getValue();
    if (staged && staged.id === base.id) {
      return Result.ok(staged.rawFrontmatter + staged.content);
    }
    return Result.ok(null);
  }

  markSavedAt(): Result<EditionStorageError, void> {
    return write(this.storage, SAVED_AT_KEY, String(Date.now()));
  }

  clearSavedAt(): Result<EditionStorageError, void> {
    return remove(this.storage, SAVED_AT_KEY);
  }

  clearAll(): Result<EditionStorageError, void> {
    const results: Result<EditionStorageError, void>[] = [
      this.clearStagedDocument(),
      this.clearRenderedDocument(),
      this.clearPendingDocument(),
      this.clearSavedAt(),
    ];
    for (const result of results) {
      if (!result.isSuccess) return result;
    }
    return Result.ok();
  }
}
