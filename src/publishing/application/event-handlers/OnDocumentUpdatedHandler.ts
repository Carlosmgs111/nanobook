import type { EventHandler } from "../../../shared/domain/bus/EventBus";
import { DocumentUpdated } from "../../../document";
import type { Result } from "../../../shared/domain/Result";
import { Result as ResultUtils } from "../../../shared/domain/Result";
import { EventBusError } from "../../../shared/domain/bus/errors";
import { PagePublisher } from "../PagePublisher";

export class OnDocumentUpdatedHandler implements EventHandler<DocumentUpdated> {
  constructor(private pagePublisher: PagePublisher) {}

  async handle(event: DocumentUpdated): Promise<Result<EventBusError, void>> {
    if (!event.payload.id) return ResultUtils.ok();
    const result = await this.pagePublisher.invalidate([
      event.payload.id as string,
    ]);
    if (!result.isSuccess) {
      return ResultUtils.fail(
        new EventBusError(`Failed to handle DocumentUpdated event`, {
          cause: result.getError(),
        })
      );
    }
    return ResultUtils.ok();
  }
}
