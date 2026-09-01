export enum DocumentEvent {
  DOCUMENT_CREATED = "Document:Created",
  DOCUMENT_UPDATED = "Document:Updated",
}

export type DocumentCreatedPayload = {
  id: string;
}

export type DocumentUpdatedPayload = {
  id: string;
}

export type DocumentEventPayloadMap = {
  [DocumentEvent.DOCUMENT_CREATED]: DocumentCreatedPayload;
  [DocumentEvent.DOCUMENT_UPDATED]: DocumentUpdatedPayload;
};
