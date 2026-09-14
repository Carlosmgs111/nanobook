import { DocumentEvent, type DocumentEventPayloadMap } from "./";
import { DomainEvent } from "../../../shared/domain/bus/EventBus";

type eventPayload = DocumentEventPayloadMap[DocumentEvent.DOCUMENT_CREATED];
type eventName = DocumentEvent.DOCUMENT_CREATED;

export class DocumentCreated extends DomainEvent<eventName> {
  static readonly name: eventName = DocumentEvent.DOCUMENT_CREATED;
  private constructor(id: string, payload: eventPayload) {
    super(DocumentEvent.DOCUMENT_CREATED, id, new Date(), payload);
  }

  static create(payload: eventPayload) {
    const id = `${DocumentEvent.DOCUMENT_CREATED}-${crypto.randomUUID()}`;
    const event = new DocumentCreated(id, payload);
    return event;
  }
}
