export abstract class DomainEvent {
  abstract readonly name: string;
  readonly id: string;
  readonly timestamp: Date;

  protected constructor(id: string, timestamp = new Date()) {
    this.id = id;
    this.timestamp = timestamp;
  }
}
