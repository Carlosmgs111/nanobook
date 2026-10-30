import { Result } from "../../../shared/domain/Result";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { Document } from "../domain/Document";
import { DocumentDeleted } from "../domain/events/DocumentDeleted";
import {
  DocumentNotFoundError,
  type DocumentServiceError,
  DocumentRepositoryError,
  DocumentParseError,
  DocumentAccessDeniedError,
} from "../domain/errors";
import type { EventBusError } from "../../../shared/domain/bus/errors";

export type DeleteDocumentError =
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | EventBusError;

export class DeleteDocument {
  constructor(
    private repository: ContentRepository,
    private eventBus: EventBus
  ) {}

  async execute(
    nanobookId: string,
    documentId: string,
    actorId: string
  ): Promise<Result<DeleteDocumentError, void>> {
    const documentResult = await this.repository.getById(nanobookId, documentId);
    if (!documentResult.isSuccess)
      return Result.fail(documentResult.getError());
    const document = documentResult.getValue();
    if (!document) return Result.fail(new DocumentNotFoundError(documentId));
    if (document.getMetadata().ownerId !== actorId) {
      return Result.fail(new DocumentAccessDeniedError(documentId));
    }

    const documentsResult = await this.repository.list(nanobookId);
    if (!documentsResult.isSuccess)
      return Result.fail(documentsResult.getError());

    const publicPath = document.getDocumentPath().getPublicValue();
    const documentsToDelete = documentsResult.getValue().filter((candidate) => {
      if (
        candidate.getDocumentId().getValue() ===
        document.getDocumentId().getValue()
      ) {
        return true;
      }

      // Only an index document represents a directory. A regular document
      // named "guides" must not delete the separate "guides/*" subtree.
      if (!document.isIndex()) return false;

      const candidatePath = candidate.getDocumentPath().getPublicValue();
      return candidatePath.startsWith(`${publicPath}/`);
    });
    const unauthorizedDocument = documentsToDelete.find(
      (documentToDelete) => documentToDelete.getMetadata().ownerId !== actorId
    );
    if (unauthorizedDocument) {
      return Result.fail(
        new DocumentAccessDeniedError(
          unauthorizedDocument.getDocumentId().getValue()
        )
      );
    }

    const deleteResult = await this.repository.deleteMany(
      nanobookId,
      documentsToDelete,
    );
    if (!deleteResult.isSuccess) return Result.fail(deleteResult.getError());

    const eventResult = await this.publishDeletedEvents(nanobookId, documentsToDelete);
    if (!eventResult.isSuccess) return Result.fail(eventResult.getError());

    return Result.ok();
  }

  private async publishDeletedEvents(nanobookId: string, documents: Document[]) {
    for (const document of documents) {
      const eventResult = await this.eventBus.publish(
        new DocumentDeleted(document.getDocumentId().getValue(), nanobookId)
      );
      if (!eventResult.isSuccess) return eventResult;
    }
    return Result.ok();
  }
}
