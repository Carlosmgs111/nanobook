import type { EventHandler } from "../../../shared/domain/bus/EventBus";
import { DocumentDeleted } from "../../../documents";
import { Result } from "../../../shared/domain/Result";
import { EventBusError } from "../../../shared/domain/bus/errors";
import { PagePublisher } from "../PagePublisher";

export class OnDocumentDeletedHandler implements EventHandler<DocumentDeleted> {
  constructor(private pagePublisher: PagePublisher) {}

  async handle(event: DocumentDeleted) {
    const result = await this.pagePublisher.invalidate([event.documentId]);
    if (!result.isSuccess) {
      return Result.fail(new EventBusError("Failed to handle DocumentDeleted event", {
        cause: result.getError(),
      }));
    }
    return Result.ok();
  }
}
