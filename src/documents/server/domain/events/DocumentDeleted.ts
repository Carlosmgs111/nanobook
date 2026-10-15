import { DomainEvent } from "../../../../shared/domain/DomainEvent";

export class DocumentDeleted extends DomainEvent {
  static readonly eventName = "document.deleted";
  readonly name = DocumentDeleted.eventName;

  constructor(readonly documentId: string, readonly nanobookId?: string) {
    super(crypto.randomUUID(), new Date());
  }
}
