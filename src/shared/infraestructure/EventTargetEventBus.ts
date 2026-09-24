import { Result } from "../domain/Result";
import { EventBusError } from "../domain/bus/errors";
import type {
  DomainEventType,
  EventBus,
  EventHandler,
} from "../domain/bus/EventBus";
import type { DomainEvent } from "../domain/DomainEvent";

export class EventTargetEventBus implements EventBus {
  private readonly target = new EventTarget();

  async publish<E extends DomainEvent>(
    event: E
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

  subscribe<E extends DomainEvent>(
    eventType: DomainEventType<E>,
    handler: EventHandler<E>
  ): () => void {
    const listener = ((rawEvent: CustomEvent) => {
      const {
        event,
        executions,
      }: {
        event: E;
        executions: Promise<Result<EventBusError, void>>[];
      } = rawEvent.detail;

      executions.push(handler.handle(event));
    }) as EventListener;

    this.target.addEventListener(eventType.eventName, listener);

    return () => {
      this.target.removeEventListener(eventType.eventName, listener);
    };
  }
}
