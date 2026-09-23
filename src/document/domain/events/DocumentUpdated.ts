import { DomainEvent } from "../../../shared/domain/DomainEvent";

export class DocumentUpdated extends DomainEvent {
  readonly name = "document.updated";
  constructor(readonly id: string) {
    super(crypto.randomUUID(), new Date());
  }
}
