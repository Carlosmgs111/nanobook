import type { ContentRepository } from "../domain/types";
import type { EventBus } from "../../shared/bus/EventBus";
import { DocumentUpdated } from "../domain/events/DocumentUpdated";
import { DocumentId } from "../domain/DocumentId";
import {
  DocumentNotFoundError,
  type DocumentServiceError,
} from "../domain/errors";
import { err, ok, type Result } from "../../shared/utils/result";
import type { DocumentInput } from "../domain/types";
import { Document } from "../domain/Document";

export class UpdateDocument {
  constructor(
    private contentRepository: ContentRepository,
    private eventBus: EventBus
  ) {}

  async execute(
    documentDelta: DocumentInput
  ): Promise<Result<void, DocumentServiceError>> {
    // console.log({ documentDelta });
    try {
      const document = await this.contentRepository.get(
        new DocumentId(documentDelta.id)
      );
      if (!document) {
        return err(new DocumentNotFoundError(new DocumentId(documentDelta.id)));
      }
      const { id, content, ...rest } = documentDelta;
      const updatedDocument = Document.create(id, rest, content);
      await this.contentRepository.update(updatedDocument);
      await this.eventBus.publish(
        DocumentUpdated.create({ id: updatedDocument.getId().getValue() })
      );
      return ok(undefined);
    } catch (error) {
      if (error instanceof DocumentNotFoundError) {
        return err(error);
      }
      console.error(error);
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
