import { Result } from "../../../../shared/domain/Result";
import type { DocumentStorage } from "../../domain/ports/DocumentStorage";
import type { SerializedEntry, CachedPreview } from "../../domain/model/StagedDocument";
import { EditionStorageError } from "../../domain/errors";

const KEY_PREFIX = "nanobook:edition";

type Kind = "staged" | "preview" | "confirmed";
type StorageResult<T> = Result<EditionStorageError, T>;

function key(kind: Kind, documentId: string): string {
  return `${KEY_PREFIX}:${encodeURIComponent(documentId)}:${kind}`;
}

function attempt<T>(action: string, key: string, run: () => T): StorageResult<T> {
  try {
    return Result.ok(run());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Result.fail(new EditionStorageError(`Failed to ${action} "${key}": ${message}`));
  }
}

/**
 * Persiste en sessionStorage únicamente documentos serializados y previews
 * renderizados; nunca contraseñas ni credenciales de desbloqueo.
 */
export class SessionStorageDocumentStorage implements DocumentStorage {
  constructor(private storage: Storage = globalThis.sessionStorage) {}

  private read<T>(kind: Kind, documentId: string): StorageResult<T | null> {
    const k = key(kind, documentId);
    return attempt("read", k, () => {
      const raw = this.storage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : null;
    });
  }

  private write(kind: Kind, documentId: string, value: unknown): StorageResult<void> {
    const k = key(kind, documentId);
    return attempt("write", k, () => this.storage.setItem(k, JSON.stringify(value)));
  }

  private remove(kind: Kind, documentId: string): StorageResult<void> {
    const k = key(kind, documentId);
    return attempt("remove", k, () => this.storage.removeItem(k));
  }

  loadStagedDocument(documentId: string) {
    return this.read<SerializedEntry>("staged", documentId);
  }

  saveStagedDocument(documentId: string, document: SerializedEntry) {
    return this.write("staged", documentId, document);
  }

  loadCachedPreview(documentId: string) {
    return this.read<CachedPreview>("preview", documentId);
  }

  saveCachedPreview(documentId: string, cached: CachedPreview) {
    return this.write("preview", documentId, cached);
  }

  loadConfirmedDocument(documentId: string) {
    return this.read<SerializedEntry>("confirmed", documentId);
  }

  saveConfirmedDocument(documentId: string, document: SerializedEntry) {
    return this.write("confirmed", documentId, document);
  }

  clearConfirmedDocument(documentId: string) {
    return this.remove("confirmed", documentId);
  }

  clearAll(documentId: string): StorageResult<void> {
    for (const kind of ["staged", "preview", "confirmed"] as const) {
      const result = this.remove(kind, documentId);
      if (!result.isSuccess) return result;
    }
    return Result.ok();
  }
}
