import { DomainEvent } from "../../../shared/domain/DomainEvent";

export class DocumentCreated extends DomainEvent {
  readonly name = "document.created";
  constructor(readonly id: string) {
    super(crypto.randomUUID(), new Date());
  }
}
