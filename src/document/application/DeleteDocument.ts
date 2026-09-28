import { Result } from "../../shared/domain/Result";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import { DocumentDeleted } from "../domain/events/DocumentDeleted";
import {
  DocumentNotFoundError,
  type DocumentServiceError,
  DocumentRepositoryError,
  DocumentParseError,
} from "../domain/errors";
import type { EventBusError } from "../../shared/domain/bus/errors";

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

  async execute(documentId: string): Promise<Result<DeleteDocumentError, void>> {
    const documentResult = await this.repository.getById(documentId);
    if (!documentResult.isSuccess) return Result.fail(documentResult.getError());
    const document = documentResult.getValue();
    if (!document) return Result.fail(new DocumentNotFoundError(documentId));

    const documentsResult = await this.repository.list();
    if (!documentsResult.isSuccess) return Result.fail(documentsResult.getError());

    const publicPath = document.getDocumentPath().getPublicValue();
    const documentsToDelete = documentsResult.getValue().filter((candidate) => {
      if (candidate.getDocumentId().getValue() === document.getDocumentId().getValue()) {
        return true;
      }

      // Only an index document represents a directory. A regular document
      // named "guides" must not delete the separate "guides/*" subtree.
      if (!document.isIndex()) return false;

      const candidatePath = candidate.getDocumentPath().getPublicValue();
      return candidatePath.startsWith(`${publicPath}/`);
    });

    for (const documentToDelete of documentsToDelete) {
      const deleteResult = await this.repository.delete(documentToDelete);
      if (!deleteResult.isSuccess) return Result.fail(deleteResult.getError());

      const eventResult = await this.eventBus.publish(
        new DocumentDeleted(documentToDelete.getDocumentId().getValue())
      );
      if (!eventResult.isSuccess) return Result.fail(eventResult.getError());
    }

    return Result.ok();
  }
}
