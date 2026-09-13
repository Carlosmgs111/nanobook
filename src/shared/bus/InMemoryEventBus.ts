import { Result } from "../utils/result";
import { EventBusError } from "./errors";
import type { EventBus, DomainEvent, EventHandler } from "./EventBus";

export class InMemoryEventBus implements EventBus {
  subscribers: Map<string, EventHandler<DomainEvent<any>>[]> = new Map();

  subscribe<K extends DomainEvent<any>>(
    eventName: K["name"],
    handler: EventHandler<K>
  ): void {
    if (!this.subscribers.get(eventName as string)) {
      this.subscribers.set(eventName as string, [handler]);
      return;
    }
    this.subscribers.get(eventName as string)?.push(handler);
  }

  async publish<T extends DomainEvent<any>>(
    event: T
  ): Promise<Result<EventBusError, void>> {
    const handlers = this.subscribers.get(event.name) ?? [];
    const results = await Promise.all(
      handlers.map((handler) => handler.handle(event))
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
