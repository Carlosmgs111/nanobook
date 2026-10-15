import { DomainEvent } from "../../../../shared/domain/DomainEvent";

export class DocumentCreated extends DomainEvent {
  static readonly eventName = "document.created";
  readonly name = DocumentCreated.eventName;

  constructor(readonly documentId: string, readonly nanobookId?: string) {
    super(crypto.randomUUID(), new Date());
  }
}
