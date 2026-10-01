import { DomainEvent } from "../../../shared/domain/DomainEvent";

export class DocumentUpdated extends DomainEvent {
  static readonly eventName = "document.updated";
  readonly name = DocumentUpdated.eventName;

  constructor(readonly documentId: string) {
    super(crypto.randomUUID(), new Date());
  }
}
