import type { DomainEvent } from "../../../shared/domain/DomainEvent";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import type { EventBusError } from "../../../shared/domain/bus/errors";
import { Result } from "../../../shared/domain/Result";

/** Publica los eventos en orden y se detiene en el primer fallo. */
export async function publishAll(
  eventBus: EventBus,
  events: DomainEvent[],
): Promise<Result<EventBusError, void>> {
  for (const event of events) {
    const published = await eventBus.publish(event);
    if (!published.isSuccess) return published;
  }
  return Result.ok();
}
