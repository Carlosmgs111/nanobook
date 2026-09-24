import type { Result } from "../Result";
import type { EventBusError } from "./errors";
import type { DomainEvent } from "../DomainEvent";

export interface EventHandler<E extends DomainEvent> {
  handle(event: E): Promise<Result<EventBusError, void>>;
}

/** A domain event class carries its own subscription key and instance type. */
export interface DomainEventType<E extends DomainEvent> {
  readonly eventName: E["name"];
  readonly prototype: E;
}

export interface EventBus {
  publish<E extends DomainEvent>(
    event: E
  ): Promise<Result<EventBusError, void>>;

  subscribe<E extends DomainEvent>(
    eventType: DomainEventType<E>,
    handler: EventHandler<E>
  ): () => void;
}
