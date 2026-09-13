import { Result } from "../../shared/utils/Result";
import type { EventBus } from "../../shared/bus/EventBus";
import type {
  ContentRepository,
  DocumentChangeNotifier,
} from "../domain/types";
import type { DocumentInput } from "../domain/types";
import { DocumentUpdated } from "../domain/events/DocumentUpdated";
import { DocumentId } from "../domain/DocumentId";
import {
  DocumentNotFoundError,
  type DocumentServiceError,
} from "../domain/errors";
import { Document } from "../domain/Document";
import type {
  DocumentNotificationError,
  DocumentRepositoryError,
  DocumentParseError,
} from "../infraestructure/errors";
import type { EventBusError } from "../../shared/bus/errors";

export type UpdateDocumentError =
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | DocumentNotificationError
  | EventBusError;

export class UpdateDocument {
  constructor(
    private contentRepository: ContentRepository,
    private eventBus: EventBus,
    private notifier: DocumentChangeNotifier
  ) {}

  async execute(
    documentDelta: DocumentInput
  ): Promise<Result<UpdateDocumentError, void>> {
    const documentResult = await this.contentRepository.getById(
      documentDelta.id
    );
    if (!documentResult.isSuccess) {
      return Result.fail(documentResult.getError());
    }

    const documentId = documentResult.getValue();
    if (!documentId) {
      return Result.fail(new DocumentNotFoundError(documentDelta.id));
    }

    const { id, content, ...rest } = documentDelta;

    const updatedDocumentResult = Document.create(id, rest, content);
    if (!updatedDocumentResult.isSuccess) {
      return Result.fail(updatedDocumentResult.getError());
    }
    const updatedDocument = updatedDocumentResult.getValue();

    const updateResult = await this.contentRepository.update(updatedDocument);
    if (!updateResult.isSuccess) {
      return Result.fail(updateResult.getError());
    }

    const updatedDocumentId = updatedDocument.getId().getValue();

    const notifyResult = await this.notifier.onDocumentUpdated(
      updatedDocumentId
    );
    if (!notifyResult.isSuccess) {
      return Result.fail(notifyResult.getError());
    }

    const publishResult = await this.eventBus.publish(
      DocumentUpdated.create({ id: updatedDocumentId })
    );
    if (!publishResult.isSuccess) {
      return Result.fail(publishResult.getError());
    }

    return Result.ok();
  }
}
