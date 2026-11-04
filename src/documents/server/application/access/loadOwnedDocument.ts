import { Result } from "../../../../shared/domain/Result";
import type { Document } from "../../domain/Document";
import { DocumentPath } from "../../domain/DocumentPath";
import { DocumentAccessDeniedError, DocumentNotFoundError, type InvalidDocumentError } from "../../domain/errors";
import type { ContentRepository, ContentRepositoryListError } from "../../domain/ports/ContentRepository";

export type LoadOwnedDocumentError =
  | ContentRepositoryListError
  | DocumentNotFoundError
  | DocumentAccessDeniedError
  | InvalidDocumentError;

/** Loads a document by public path and requires the actor to own it. */
export async function loadOwnedDocument(
  contentRepository: ContentRepository,
  nanobookId: string,
  documentPath: string,
  actorId: string,
): Promise<Result<LoadOwnedDocumentError, Document>> {
  const pathResult = DocumentPath.create(documentPath);
  if (!pathResult.isSuccess) return Result.fail(new DocumentNotFoundError(documentPath));

  const found = await contentRepository.getByPublicPath(nanobookId, pathResult.getValue().getPublicValue());
  if (!found.isSuccess) return Result.fail(found.getError());

  const document = found.getValue();
  if (!document) return Result.fail(new DocumentNotFoundError(documentPath));
  if (document.getMetadata().ownerId !== actorId) {
    return Result.fail(new DocumentAccessDeniedError(document.getDocumentId().getValue()));
  }
  return Result.ok(document);
}
