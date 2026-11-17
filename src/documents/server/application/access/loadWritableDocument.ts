import { Result } from "../../../../shared/domain/Result";
import type { Document } from "../../domain/Document";
import { DocumentPath } from "../../domain/DocumentPath";
import {
  DocumentNotFoundError,
  type DocumentRepositoryError,
  type InvalidDocumentError,
  type WriteAccessDeniedError,
} from "../../domain/errors";
import type { ContentRepository, ContentRepositoryListError } from "../../domain/ports/ContentRepository";
import type { WriteAccess } from "../../domain/ports/WriteAccess";

export type LoadWritableDocumentError =
  | WriteAccessDeniedError
  | DocumentRepositoryError
  | ContentRepositoryListError
  | DocumentNotFoundError
  | InvalidDocumentError;

/** Carga un documento por ruta pública exigiendo permiso de escritura sobre su nanobook. */
export async function loadWritableDocument(
  writeAccess: WriteAccess,
  contentRepository: ContentRepository,
  nanobookId: string,
  documentPath: string,
  actorId: string,
): Promise<Result<LoadWritableDocumentError, Document>> {
  const writable = await writeAccess.require(nanobookId, actorId);
  if (!writable.isSuccess) return Result.fail(writable.getError());

  const pathResult = DocumentPath.create(documentPath);
  if (!pathResult.isSuccess) return Result.fail(new DocumentNotFoundError(documentPath));

  const found = await contentRepository.getByPublicPath(nanobookId, pathResult.getValue().getPublicValue());
  if (!found.isSuccess) return Result.fail(found.getError());

  const document = found.getValue();
  if (!document) return Result.fail(new DocumentNotFoundError(documentPath));
  return Result.ok(document);
}
