import type { Result } from "../Result";
import type { EventBusError } from "./errors";

export interface EventHandler<E extends DomainEvent> {
  handle(event: E): Promise<Result<EventBusError, void>>;
}

export abstract class DomainEvent {
  abstract readonly name: string;
  readonly id: string;
  readonly timestamp: Date;

  protected constructor(id: string, timestamp = new Date()) {
    this.id = id;
    this.timestamp = timestamp;
  }
}

// export class DocumentPublished extends DomainEvent {
//   readonly name = "document.published";

//   constructor(
//     id: string,
//     readonly documentId: string,
//     readonly version: number,
//     timestamp = new Date(),
//   ) {
//     super(id, timestamp);
//   }
// }

export interface EventBus {
  publish<E extends DomainEvent>(
    event: E
  ): Promise<Result<EventBusError, void>>;

  subscribe<E extends DomainEvent>(
    eventName: E["name"],
    handler: EventHandler<E>
  ): void;
}
