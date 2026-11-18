import {
  Subject,
  type AccessCheckFailedError,
  type AccessDeniedError,
  type Authorizer,
} from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import type { EventBusError } from "../../../shared/domain/bus/errors";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import { DocumentDeleted } from "../domain/events/DocumentDeleted";
import {
  DocumentNotFoundError,
  type DocumentServiceError,
  type DocumentRepositoryError,
  type DocumentParseError,
} from "../domain/errors";
import { publishAll } from "./publishAll";

export type DeleteDocumentError =
  | AccessDeniedError
  | AccessCheckFailedError
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | EventBusError;

export class DeleteDocument {
  constructor(
    private repository: ContentRepository,
    private eventBus: EventBus,
    private authorizer: Authorizer,
  ) {}

  async execute(
    nanobookId: string,
    documentId: string,
    actorId: string,
  ): Promise<Result<DeleteDocumentError, void>> {
    const writable = await this.authorizer.require({
      subject: Subject.of(actorId),
      action: "write",
      resource: { type: "document", id: documentId, nanobookId },
    });
    if (!writable.isSuccess) return Result.fail(writable.getError());

    const found = await this.repository.getById(nanobookId, documentId);
    if (!found.isSuccess) return Result.fail(found.getError());
    const document = found.getValue();
    if (!document) return Result.fail(new DocumentNotFoundError(documentId));

    const listed = await this.repository.list(nanobookId);
    if (!listed.isSuccess) return Result.fail(listed.getError());

    // Solo un índice representa un directorio: un documento normal no borra su subárbol.
    const publicPath = document.getPublicPath();
    const documentsToDelete = listed.getValue().filter(
      (candidate) =>
        candidate.getDocumentId().getValue() === documentId ||
        (document.isIndex() && candidate.getPublicPath().startsWith(`${publicPath}/`)),
    );

    const deleted = await this.repository.deleteMany(nanobookId, documentsToDelete);
    if (!deleted.isSuccess) return Result.fail(deleted.getError());

    return publishAll(
      this.eventBus,
      documentsToDelete.map((deletedDocument) => new DocumentDeleted(deletedDocument.getDocumentId().getValue(), nanobookId)),
    );
  }
}
