import type { EventHandler } from "../../../shared/bus/EventBus";
import { DocumentUpdated } from "../../../document";
import type { Result } from "../../../shared/utils/result";
import { Result as ResultUtils } from "../../../shared/utils/result";
import { EventBusError } from "../../../shared/bus/errors";
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
