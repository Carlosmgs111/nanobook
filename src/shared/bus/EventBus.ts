import type { Result } from "../utils/result";
import type { EventBusError } from "./errors";

export interface EventHandler<DomainEvent> {
  handle(event: DomainEvent): Promise<Result<EventBusError, void>>;
}

export class DomainEvent<T> {
  readonly name: T;
  readonly id: string;
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;
  constructor(
    name: T,
    id: string,
    timestamp: Date,
    payload: Record<string, unknown>
  ) {
    console.log({name})
    this.name = name;
    this.id = id;
    this.timestamp = timestamp;
    this.payload = payload;
  }
}

export interface EventBus {
  publish<T extends DomainEvent<unknown>>(event: T): Promise<Result<EventBusError, void>>;
  subscribe<K extends DomainEvent<unknown>>(
    eventName: K["name"],
    handler: EventHandler<K>
  ): void;
}
