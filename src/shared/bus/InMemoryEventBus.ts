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

  publish<T extends DomainEvent<any>>(event: T): Promise<void> {
    return new Promise((resolve) => {
      this.subscribers.get(event.name)?.forEach((handler) => {
        handler.handle(event);
      });
      resolve();
    });
  }
}
