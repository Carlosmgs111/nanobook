import { Result } from "../domain/Result";
import { EventBusError } from "../domain/bus/errors";
import type {
  DomainEventType,
  EventBus,
  EventHandler,
} from "../domain/bus/EventBus";
import type { DomainEvent } from "../domain/DomainEvent";

export class InMemoryEventBus implements EventBus {
  private readonly subscribers = new Map<
    string,
    Set<(event: DomainEvent) => Promise<Result<EventBusError, void>>>
  >();

  subscribe<E extends DomainEvent>(
    eventType: DomainEventType<E>,
    handler: EventHandler<E>
  ): () => void {
    const key = eventType.eventName;
    const handlers = this.subscribers.get(key) ?? new Set();
    const invoke = (event: DomainEvent) => handler.handle(event as E);
    handlers.add(invoke);
    this.subscribers.set(key, handlers);

    return () => {
      handlers.delete(invoke);
      if (handlers.size === 0) this.subscribers.delete(key);
    };
  }

  async publish<E extends DomainEvent>(
    event: E
  ): Promise<Result<EventBusError, void>> {
    const handlers = this.subscribers.get(event.name) ?? new Set();
    const results = await Promise.all(
      [...handlers].map((handler) => handler(event))
    );

    const failures = results.filter((result) => !result.isSuccess);
    if (failures.length === 0) {
      return Result.ok();
    }

    const messages = failures
      .map((result) => result.getError().message)
      .join("; ");
    return Result.fail(
      new EventBusError(
        `Failed to publish event "${String(event.name)}": ${messages}`
      )
    );
  }
}
