import type { Result } from "../../shared/utils/result";
import type { EventBus } from "../../shared/bus/EventBus";
import type { ContentRepository, DocumentChangeNotifier } from "../domain/types";
import type { DocumentInput } from "../domain/types";
import { DocumentUpdated } from "../domain/events/DocumentUpdated";
import { DocumentId } from "../domain/DocumentId";
import {
  DocumentNotFoundError,
  type DocumentServiceError,
} from "../domain/errors";
import { Result as ResultUtils } from "../../shared/utils/result";
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
    const documentIdResult = DocumentId.create(documentDelta.id);
    if (!documentIdResult.isSuccess) {
      return ResultUtils.fail(documentIdResult.getError());
    }
    const documentId = documentIdResult.getValue();

    const documentResult = await this.contentRepository.get(documentId);
    if (!documentResult.isSuccess) {
      return ResultUtils.fail(documentResult.getError());
    }
    if (!documentResult.getValue()) {
      return ResultUtils.fail(new DocumentNotFoundError(documentId));
    }

    const { id, content, ...rest } = documentDelta;

    const updatedDocumentResult = Document.create(id, rest, content);
    if (!updatedDocumentResult.isSuccess) {
      return ResultUtils.fail(updatedDocumentResult.getError());
    }
    const updatedDocument = updatedDocumentResult.getValue();

    const updateResult = await this.contentRepository.update(updatedDocument);
    if (!updateResult.isSuccess) {
      return ResultUtils.fail(updateResult.getError());
    }

    const updatedDocumentId = updatedDocument.getId().getValue();

    const notifyResult = await this.notifier.onDocumentUpdated(updatedDocumentId);
    if (!notifyResult.isSuccess) {
      return ResultUtils.fail(notifyResult.getError());
    }

    const publishResult = await this.eventBus.publish(
      DocumentUpdated.create({ id: updatedDocumentId })
    );
    if (!publishResult.isSuccess) {
      return ResultUtils.fail(publishResult.getError());
    }

    return ResultUtils.ok();
  }
}
