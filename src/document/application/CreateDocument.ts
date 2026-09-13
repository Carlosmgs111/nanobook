import type { EventBus } from "../../shared/bus/EventBus";
import  { Result } from "../../shared/utils/Result";
import type {
  ContentRepository,
  DocumentChangeNotifier,
} from "../domain/types";
import type { DocumentServiceError } from "../domain/errors";
import { DocumentCreated } from "../domain/events/DocumentCreated";
import { Document } from "../domain/Document";
import {
  InvalidDocumentIdError,
  ParentNotFoundError,
} from "../domain/errors";
import { DocumentId } from "../domain/DocumentId";
import type { DocumentInput } from "../domain/types";
import type {
  DocumentNotificationError,
  DocumentRepositoryError,
  DocumentParseError,
} from "../infraestructure/errors";
import type { EventBusError } from "../../shared/bus/errors";

export type CreateDocumentError =
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | DocumentNotificationError
  | EventBusError;

export class CreateDocument {
  constructor(
    private repository: ContentRepository,
    private eventBus: EventBus,
    private notifier: DocumentChangeNotifier
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

    const parentId = id.getParentId();
    if (parentId !== null) {
      const parentResult = await this.repository.getById(parentId.getValue());
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
      },
      ""
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

    const notifyDocResult = await this.notifier.onDocumentCreated(documentId);
    if (!notifyDocResult.isSuccess) {
      return Result.fail(notifyDocResult.getError());
    }

    if (parentId !== null) {
      const notifyParentResult = await this.notifier.onDocumentCreated(
        parentId.getValue()
      );
      if (!notifyParentResult.isSuccess) {
        return Result.fail(notifyParentResult.getError());
      }
    }

    const publishDocResult = await this.eventBus.publish(
      DocumentCreated.create({ id: documentId })
    );
    if (!publishDocResult.isSuccess) {
      return Result.fail(publishDocResult.getError());
    }

    if (parentId !== null) {
      const publishParentResult = await this.eventBus.publish(
        DocumentCreated.create({ id: parentId.getValue() })
      );
      if (!publishParentResult.isSuccess) {
        return Result.fail(publishParentResult.getError());
      }
    }

    return Result.ok(document);
  }
}
