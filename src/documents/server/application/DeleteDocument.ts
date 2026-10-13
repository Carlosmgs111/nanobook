import { Result } from "../../../shared/domain/Result";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { Document } from "../domain/Document";
import { DocumentDeleted } from "../domain/events/DocumentDeleted";
import {
  DocumentNotFoundError,
  DocumentDeletionPartialError,
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
    documentId: string,
    actorId: string
  ): Promise<Result<DeleteDocumentError, void>> {
    const documentResult = await this.repository.getById(documentId);
    if (!documentResult.isSuccess)
      return Result.fail(documentResult.getError());
    const document = documentResult.getValue();
    if (!document) return Result.fail(new DocumentNotFoundError(documentId));
    if (document.getMetadata().ownerId !== actorId) {
      return Result.fail(new DocumentAccessDeniedError(documentId));
    }

    const documentsResult = await this.repository.list();
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
    const deletedDocuments = [] as typeof documentsToDelete;
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

    for (const documentToDelete of documentsToDelete) {
      const deleteResult = await this.repository.delete(documentToDelete);
      if (!deleteResult.isSuccess) {
        if (deletedDocuments.length === 0)
          return Result.fail(deleteResult.getError());

        const eventResult = await this.publishDeletedEvents(deletedDocuments);
        if (!eventResult.isSuccess) return Result.fail(eventResult.getError());

        return Result.fail(
          new DocumentDeletionPartialError(
            deletedDocuments.map((deleted) =>
              deleted.getDocumentId().getValue()
            ),
            documentToDelete.getDocumentId().getValue(),
            { cause: deleteResult.getError() }
          )
        );
      }
      deletedDocuments.push(documentToDelete);
    }

    const eventResult = await this.publishDeletedEvents(deletedDocuments);
    if (!eventResult.isSuccess) return Result.fail(eventResult.getError());

    return Result.ok();
  }

  private async publishDeletedEvents(documents: Document[]) {
    for (const document of documents) {
      const eventResult = await this.eventBus.publish(
        new DocumentDeleted(document.getDocumentId().getValue())
      );
      if (!eventResult.isSuccess) return eventResult;
    }
    return Result.ok();
  }
}
