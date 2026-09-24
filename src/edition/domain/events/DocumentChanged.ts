import { DomainEvent } from "../../../shared/domain/DomainEvent";

export class DocumentChanged extends DomainEvent {
  static readonly eventName = "document.changed";
  readonly name = DocumentChanged.eventName;

  constructor(readonly documentId: string) {
    super(crypto.randomUUID(), new Date());
  }
}
