import { Result } from "../../shared/domain/Result";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { DocumentInput } from "./dto/DocumentInput";
import { DocumentUpdated } from "../domain/events/DocumentUpdated";
import { DocumentPath } from "../domain/DocumentPath";
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
    const pathResult = DocumentPath.create(documentDelta.id);
    if (!pathResult.isSuccess) {
      return Result.fail(new InvalidDocumentIdError(documentDelta.id));
    }

    const documentResult = this.contentRepository.getByPath
      ? await this.contentRepository.getByPath(documentDelta.id)
      : await this.contentRepository.getById(documentDelta.id);
    if (!documentResult.isSuccess) {
      return Result.fail(documentResult.getError());
    }

    const existingDocument = documentResult.getValue();
    if (!existingDocument) {
      return Result.fail(new DocumentNotFoundError(documentDelta.id));
    }

    const { id, content, ...rest } = documentDelta;

    const updatedDocumentResult = Document.create(
      id,
      rest,
      content,
      undefined,
      undefined,
      existingDocument.getDocumentId().getValue()
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
