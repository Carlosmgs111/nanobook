import { Result } from "../../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { DocumentWriter } from "./ports/DocumentWriter";
import type { EditionStorageError, EditionWriterError } from "../domain/errors";

export type RenameDocumentError =
  | EditionStorageError
  | EditionWriterError
  | Error;

const DOCUMENT_PATH_PATTERN = /^(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N}_-]+$/u;

export class RenameDocument {
  constructor(
    private storage: DocumentStorage,
    private writer: DocumentWriter
  ) {}

  async execute(
    documentId: string,
    path: string
  ): Promise<Result<RenameDocumentError, SerializedEntry>> {
    const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
    if (!DOCUMENT_PATH_PATTERN.test(normalizedPath)) {
      return Result.fail(new Error("La ruta del documento no es válida"));
    }

    const stagedResult = this.storage.loadStagedDocument(documentId);
    if (!stagedResult.isSuccess) return Result.fail(stagedResult.getError());
    const staged = stagedResult.getValue();
    if (!staged) return Result.fail(new Error("Staged document not found"));

    const renamed = withRenamedPath(staged, normalizedPath);
    const writeResult = await this.writer.updateDocument(documentId, renamed);
    if (!writeResult.isSuccess) return Result.fail(writeResult.getError());

    const saveStagedResult = this.storage.saveStagedDocument(documentId, renamed);
    if (!saveStagedResult.isSuccess) return Result.fail(saveStagedResult.getError());
    const saveConfirmedResult = this.storage.saveConfirmedDocument(documentId, renamed);
    if (!saveConfirmedResult.isSuccess) return Result.fail(saveConfirmedResult.getError());

    return Result.ok(renamed);
  }
}

function withRenamedPath(document: SerializedEntry, path: string): SerializedEntry {
  const isIndex = path === "index" || path.endsWith("/index");
  const publicPath = isIndex && path !== "index"
    ? path.slice(0, -"/index".length)
    : path;
  const lastSlash = publicPath.lastIndexOf("/");
  const parentPath = publicPath === "index"
    ? undefined
    : isIndex
      ? publicPath
    : lastSlash === -1
      ? "index"
      : publicPath.slice(0, lastSlash);

  return {
    ...document,
    path,
    slug: path,
    isIndex,
    parentPath,
  };
}
