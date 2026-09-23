import type { Result } from "../Result";
import type { EventBusError } from "./errors";
import type { DomainEvent } from "../DomainEvent";

export interface EventHandler<E extends DomainEvent> {
  handle(event: E): Promise<Result<EventBusError, void>>;
}

export interface EventBus {
  publish<E extends DomainEvent>(
    event: E
  ): Promise<Result<EventBusError, void>>;

  subscribe<E extends DomainEvent>(
    eventName: E["name"],
    handler: EventHandler<E>
  ): void;
}
