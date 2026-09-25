import type { EventBus } from "../../shared/domain/bus/EventBus";
import { Result } from "../../shared/domain/Result";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import {
  DocumentAlreadyExistsError,
  InvalidDocumentIdError,
  ParentNotFoundError,
  DocumentRepositoryError,
  DocumentParseError,
  type DocumentServiceError,
} from "../domain/errors";
import { DocumentCreated } from "../domain/events/DocumentCreated";
import { Document } from "../domain/Document";
import { DocumentId } from "../domain/DocumentId";
import { DocumentPath } from "../domain/DocumentPath";
import type { DocumentInput } from "./dto/DocumentInput";
import type { EventBusError } from "../../shared/domain/bus/errors";

export type CreateDocumentError =
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | EventBusError;

export class CreateDocument {
  constructor(
    private repository: ContentRepository,
    private eventBus: EventBus
  ) {}

  async execute(
    input: DocumentInput
  ): Promise<Result<CreateDocumentError, Document>> {
    const pathResult = DocumentPath.create(input.id);
    if (!pathResult.isSuccess) {
      return Result.fail(pathResult.getError());
    }
    const path = pathResult.getValue();

    if (path.isIndex() && input.index === false) {
      return Result.fail(new InvalidDocumentIdError(path.getValue()));
    }

    const existingResult = await this.repository.getByPath(path.getValue());
    if (!existingResult.isSuccess) {
      return Result.fail(existingResult.getError());
    }
    if (existingResult.getValue()) {
      return Result.fail(new DocumentAlreadyExistsError(path.getValue()));
    }

    const parentPath = path.getParentPath();
    let parentDocument: Document | null = null;
    if (parentPath !== null) {
      const parentResult = await this.repository.getByPath(parentPath.getValue());
      if (!parentResult.isSuccess) {
        return Result.fail(parentResult.getError());
      }
      parentDocument = parentResult.getValue();
      if (!parentDocument) {
        return Result.fail(new ParentNotFoundError(parentPath.getValue()));
      }
      if (!parentDocument.getMetadata().index) {
        return Result.fail(new InvalidDocumentIdError(parentPath.getValue()));
      }
    }

    const documentResult = Document.create(
      input.id,
      {
        title: input.title,
        description: input.description,
        author: input.author,
        date: input.date,
        index: input.index,
        position: input.position,
        draft: input.draft,
        tags: input.tags,
        cover: input.cover,
        ref: input.ref,
      },
      input.content,
      undefined,
      undefined,
      DocumentId.generate().getValue()
    );
    if (!documentResult.isSuccess) {
      return Result.fail(documentResult.getError());
    }
    const document = documentResult.getValue();

    const createResult = await this.repository.create(document);
    if (!createResult.isSuccess) {
      return Result.fail(createResult.getError());
    }

    const documentId = document.getDocumentId().getValue();

    const documentEventResult = await this.eventBus.publish(
      new DocumentCreated(documentId)
    );
    if (!documentEventResult.isSuccess) {
      return Result.fail(documentEventResult.getError());
    }

    if (parentDocument !== null) {
      const parentEventResult = await this.eventBus.publish(
        new DocumentCreated(parentDocument.getDocumentId().getValue())
      );
      if (!parentEventResult.isSuccess) {
        return Result.fail(parentEventResult.getError());
      }
    }

    return Result.ok(document);
  }
}
