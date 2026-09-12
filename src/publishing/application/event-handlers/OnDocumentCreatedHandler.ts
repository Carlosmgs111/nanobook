import type { EventHandler } from "../../../shared/bus/EventBus";
import { DocumentCreated } from "../../../document";
import type { Result } from "../../../shared/utils/result";
import { err, ok } from "../../../shared/utils/result";
import { PagePublisher } from "../PagePublisher";

export class OnDocumentCreatedHandler implements EventHandler<DocumentCreated> {
  constructor(private pagePublisher: PagePublisher) {}
  async handle(event: DocumentCreated): Promise<Result<Error, void>> {
    if (!event.payload.id) return err(undefined);
    this.pagePublisher.invalidate([event.payload.id as string]);
    return ok();
  }
}
