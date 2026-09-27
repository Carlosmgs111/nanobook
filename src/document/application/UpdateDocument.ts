import { Result } from "../../shared/domain/Result";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { DocumentInput } from "./dto/DocumentInput";
import { DocumentUpdated } from "../domain/events/DocumentUpdated";
import {
  DocumentNotFoundError,
  DocumentRepositoryError,
  DocumentParseError,
  InvalidDocumentIdError,
  type DocumentServiceError,
} from "../domain/errors";
import { Document } from "../domain/Document";
import type { EventBusError } from "../../shared/domain/bus/errors";

export type UpdateDocumentError =
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | EventBusError;

export class UpdateDocument {
  constructor(
    private contentRepository: ContentRepository,
    private eventBus: EventBus
  ) {}

  async execute(
    documentDelta: DocumentInput
  ): Promise<Result<UpdateDocumentError, void>> {
    const documentId = documentDelta.id;
    if (!documentId) {
      return Result.fail(new InvalidDocumentIdError(documentId ?? ""));
    }

    const documentResult = await this.contentRepository.getById(documentId);
    if (!documentResult.isSuccess) {
      return Result.fail(documentResult.getError());
    }

    const existingDocument = documentResult.getValue();
    if (!existingDocument) {
      return Result.fail(new DocumentNotFoundError(documentId));
    }

    const { id, path, content, ...rest } = documentDelta;

    const updatedDocumentResult = Document.create(
      path,
      rest,
      content,
      undefined,
      undefined,
      documentId
    );
    if (!updatedDocumentResult.isSuccess) {
      return Result.fail(updatedDocumentResult.getError());
    }
    const updatedDocument = updatedDocumentResult.getValue();

    const updateResult = await this.contentRepository.update(updatedDocument);
    if (!updateResult.isSuccess) {
      return Result.fail(updateResult.getError());
    }

    const updatedDocumentId = updatedDocument.getDocumentId().getValue();

    const eventResult = await this.eventBus.publish(
      new DocumentUpdated(updatedDocumentId)
    );
    if (!eventResult.isSuccess) {
      return Result.fail(eventResult.getError());
    }

    return Result.ok();
  }
}
