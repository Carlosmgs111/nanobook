import type { SerializedEntry, CreateDocumentRequest } from "../../../document";

export interface DocumentWriter {
  createDocument(document: CreateDocumentRequest): Promise<SerializedEntry>;
  updateDocument(
    documentId: string,
    document: SerializedEntry
  ): Promise<SerializedEntry>;
}
