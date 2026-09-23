import { DomainEvent } from "../../../shared/domain/DomainEvent";

export class DocumentChanged extends DomainEvent {
  readonly name = "document.changed";
  constructor(readonly documentId: string) {
    super(crypto.randomUUID(), new Date());
  }
}
