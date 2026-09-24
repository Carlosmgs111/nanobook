import type { EventHandler } from "../../../shared/domain/bus/EventBus";
import { DocumentUpdated } from "../../../document";
import { Result } from "../../../shared/domain/Result";
import { EventBusError } from "../../../shared/domain/bus/errors";
import { PagePublisher } from "../PagePublisher";

export class OnDocumentUpdatedHandler implements EventHandler<DocumentUpdated> {
  constructor(private pagePublisher: PagePublisher) {}

  async handle(event: DocumentUpdated): Promise<Result<EventBusError, void>> {
    if (!event.documentId) return Result.ok();
    const result = await this.pagePublisher.invalidate([event.documentId]);
    if (!result.isSuccess) {
      return Result.fail(
        new EventBusError(`Failed to handle DocumentUpdated event`, {
          cause: result.getError(),
        })
      );
    }
    return Result.ok();
  }
}
