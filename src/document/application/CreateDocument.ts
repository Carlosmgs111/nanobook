import type { EventBus } from "../../shared/bus/EventBus";
import type { Result } from "../../shared/utils/result";
import type {
  ContentRepository,
  DocumentChangeNotifier,
} from "../domain/types";
import type { DocumentServiceError } from "../domain/errors";
import { DocumentCreated } from "../domain/events/DocumentCreated";
import { Document } from "../domain/Document";
import { Result as ResultUtils } from "../../shared/utils/result";
import {
  DocumentAlreadyExistsError,
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
      return ResultUtils.fail(idResult.getError());
    }
    const id = idResult.getValue();

    const isIndex = id.isIndexId();

    if (isIndex && input.index === false) {
      return ResultUtils.fail(new InvalidDocumentIdError(id));
    }

    const existingResult = await this.repository.get(id);
    if (!existingResult.isSuccess) {
      return ResultUtils.fail(existingResult.getError());
    }
    if (existingResult.getValue()) {
      return ResultUtils.fail(new DocumentAlreadyExistsError(id));
    }

    const parentId = id.getParentId();
    if (parentId !== null) {
      const parentResult = await this.repository.get(parentId);
      if (!parentResult.isSuccess) {
        return ResultUtils.fail(parentResult.getError());
      }
      const parent = parentResult.getValue();
      if (!parent) {
        return ResultUtils.fail(new ParentNotFoundError(parentId));
      }
      if (!parent.getMetadata().index) {
        return ResultUtils.fail(new InvalidDocumentIdError(parentId));
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
      return ResultUtils.fail(documentResult.getError());
    }
    const document = documentResult.getValue();

    const createResult = await this.repository.create(document);
    if (!createResult.isSuccess) {
      return ResultUtils.fail(createResult.getError());
    }

    const documentId = document.getId().getValue();

    const notifyDocResult = await this.notifier.onDocumentCreated(documentId);
    if (!notifyDocResult.isSuccess) {
      return ResultUtils.fail(notifyDocResult.getError());
    }

    if (parentId !== null) {
      const notifyParentResult = await this.notifier.onDocumentCreated(
        parentId.getValue()
      );
      if (!notifyParentResult.isSuccess) {
        return ResultUtils.fail(notifyParentResult.getError());
      }
    }

    const publishDocResult = await this.eventBus.publish(
      DocumentCreated.create({ id: documentId })
    );
    if (!publishDocResult.isSuccess) {
      return ResultUtils.fail(publishDocResult.getError());
    }

    if (parentId !== null) {
      const publishParentResult = await this.eventBus.publish(
        DocumentCreated.create({ id: parentId.getValue() })
      );
      if (!publishParentResult.isSuccess) {
        return ResultUtils.fail(publishParentResult.getError());
      }
    }

    return ResultUtils.ok(document);
  }
}
