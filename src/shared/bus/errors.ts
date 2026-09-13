import { InfrastructureError } from "../errors";

export class EventBusError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EventBusError";
  }
}
