import { Result } from "../domain/Result";
import { EventBusError } from "../domain/bus/errors";
import type {
  EventBus,
  DomainEvent,
  EventHandler,
} from "../domain/bus/EventBus";

export class EventTargetEventBus implements EventBus {
  private readonly target = new EventTarget();

  async publish<T extends DomainEvent<unknown>>(
    event: T
  ): Promise<Result<EventBusError, void>> {
    const executions: Promise<Result<EventBusError, void>>[] = [];

    const nativeEvent = new CustomEvent(String(event.name), {
      detail: {
        event,
        executions,
      },
    });

    this.target.dispatchEvent(nativeEvent);

    const results = await Promise.all(executions);

    const failure = results.find((result) => {
      if (!result.isSuccess) return result.getError();
    });

    return failure ?? Result.ok();
  }

  subscribe<K extends DomainEvent<unknown>>(
    eventName: K["name"],
    handler: EventHandler<K>
  ): void {
    this.target.addEventListener(String(eventName), ((
      rawEvent: CustomEvent
    ) => {
      const {
        event,
        executions,
      }: {
        event: K;
        executions: Promise<Result<EventBusError, void>>[];
      } = rawEvent.detail;

      executions.push(handler.handle(event));
    }) as EventListener);
  }
}
