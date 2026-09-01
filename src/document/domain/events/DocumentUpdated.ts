import { DocumentEvent, type DocumentEventPayloadMap } from "./";
import { DomainEvent } from "../../../shared/bus/EventBus";

type eventPayload = DocumentEventPayloadMap[DocumentEvent.DOCUMENT_UPDATED];
type eventName = DocumentEvent.DOCUMENT_UPDATED;

export class DocumentUpdated extends DomainEvent<eventName> {
  static readonly name: eventName = DocumentEvent.DOCUMENT_UPDATED;
  private constructor(id: string, payload: eventPayload) {
    super(DocumentEvent.DOCUMENT_UPDATED, id, new Date(), payload);
  }

  static create(payload: eventPayload) {
    const id = `${DocumentEvent.DOCUMENT_UPDATED}-${crypto.randomUUID()}`;
    const event = new DocumentUpdated(id, payload);
    return event;
  }
}
