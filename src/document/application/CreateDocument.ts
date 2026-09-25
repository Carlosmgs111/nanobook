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
    const idResult = DocumentId.create(input.id);
    if (!idResult.isSuccess) {
      return Result.fail(idResult.getError());
    }
    const id = idResult.getValue();

    if (id.isIndexId() && input.index === false) {
      return Result.fail(new InvalidDocumentIdError(id.getValue()));
    }

    const existingResult = this.repository.getByPath
      ? await this.repository.getByPath(id.getValue())
      : await this.repository.getById(id.getValue());
    if (!existingResult.isSuccess) {
      return Result.fail(existingResult.getError());
    }
    if (existingResult.getValue()) {
      return Result.fail(new DocumentAlreadyExistsError(id.getValue()));
    }

    const parentId = id.getParentId();
    if (parentId !== null) {
      const parentResult = this.repository.getByPath
        ? await this.repository.getByPath(parentId.getValue())
        : await this.repository.getById(parentId.getValue());
      if (!parentResult.isSuccess) {
        return Result.fail(parentResult.getError());
      }
      const parent = parentResult.getValue();
      if (!parent) {
        return Result.fail(new ParentNotFoundError(parentId.getValue()));
      }
      if (!parent.getMetadata().index) {
        return Result.fail(new InvalidDocumentIdError(parentId.getValue()));
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

    const documentId = document.getId().getValue();

    this.eventBus.publish(new DocumentCreated(documentId));

    if (parentId !== null) {
      await this.eventBus.publish(new DocumentCreated(parentId.getValue()));
    }

    return Result.ok(document);
  }
}
