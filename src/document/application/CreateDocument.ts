import type { EventBus } from "../../shared/bus/EventBus";
import type { ContentRepository } from "../domain/types";
import { DocumentCreated } from "../domain/events/DocumentCreated";
// import type { PublishService } from "./PublishService.port";
import type { DocumentServiceError } from "../domain/errors";
import { Document } from "../domain/Document";
import type { Result } from "../../shared/utils/result";
import { ok, err } from "../../shared/utils/result";
import {
  DocumentAlreadyExistsError,
  InvalidDocumentIdError,
  ParentNotFoundError,
} from "../domain/errors";
import { DocumentId } from "../domain/DocumentId";
import type { DocumentInput } from "../domain/types";

export class CreateDocument {
  constructor(
    private repository: ContentRepository,
    private eventBus: EventBus
  ) {}

  async execute(
    input: DocumentInput
  ): Promise<Result<Document, DocumentServiceError>> {
    try {
      const id = new DocumentId(input.id);
      const isIndex = id.isIndexId();

      if (isIndex && input.index === false) {
        return err(new InvalidDocumentIdError(id));
      }

      const existing = await this.repository.get(id);
      if (existing) {
        return err(new DocumentAlreadyExistsError(id));
      }

      const parentId = id.getParentId();
      if (parentId !== null) {
        const parent = await this.repository.get(parentId);
        if (!parent) {
          return err(new ParentNotFoundError(parentId));
        }
        if (!parent.getMetadata().index) {
          return err(new InvalidDocumentIdError(parentId));
        }
      }

      const document = Document.create(input.id, {
        title: input.title,
        description: input.description,
        author: input.author,
        date: input.date,
        index: input.index,
        position: input.position,
        draft: input.draft,
        tags: input.tags,
      }, "", );

      await this.repository.create(document);
      await this.eventBus.publish(
        DocumentCreated.create({ id: document.getId().getValue() })
      );
      if (parentId !== null) {
        await this.eventBus.publish(
          DocumentCreated.create({ id: parentId.getValue() })
        );
      }

      return ok(document);
    } catch (error) {
      console.error(error);
      if (error instanceof InvalidDocumentIdError) {
        return err(error);
      }
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
