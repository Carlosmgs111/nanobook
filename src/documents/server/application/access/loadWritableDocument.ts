import {
  Subject,
  type AccessCheckFailedError,
  type AccessDeniedError,
  type Authorizer,
} from "../../../../authorization/server";
import { Result } from "../../../../shared/domain/Result";
import type { Document } from "../../domain/Document";
import { DocumentPath } from "../../domain/DocumentPath";
import {
  DocumentNotFoundError,
  type DocumentRepositoryError,
  type InvalidDocumentError,
} from "../../domain/errors";
import type { ContentRepository, ContentRepositoryListError } from "../../domain/ports/ContentRepository";

export type LoadWritableDocumentError =
  | AccessDeniedError
  | AccessCheckFailedError
  | DocumentRepositoryError
  | ContentRepositoryListError
  | DocumentNotFoundError
  | InvalidDocumentError;

/** Carga un documento por ruta pública exigiendo permiso de escritura sobre su nanobook. */
export async function loadWritableDocument(
  authorizer: Authorizer,
  contentRepository: ContentRepository,
  nanobookId: string,
  documentPath: string,
  actorId: string,
): Promise<Result<LoadWritableDocumentError, Document>> {
  const writable = await authorizer.require({
    subject: Subject.of(actorId),
    action: "write",
    resource: { type: "document", id: documentPath, nanobookId },
  });
  if (!writable.isSuccess) return Result.fail(writable.getError());

  const pathResult = DocumentPath.create(documentPath);
  if (!pathResult.isSuccess) return Result.fail(new DocumentNotFoundError(documentPath));

  const found = await contentRepository.getByPublicPath(nanobookId, pathResult.getValue().getPublicValue());
  if (!found.isSuccess) return Result.fail(found.getError());

  const document = found.getValue();
  if (!document) return Result.fail(new DocumentNotFoundError(documentPath));
  return Result.ok(document);
}
