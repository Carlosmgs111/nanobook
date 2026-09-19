import type { DocumentWriter } from "./ports/DocumentWriter";
import type { SerializedEntry, CreateDocumentRequest } from "../../document";

export class CreateDocument {
  constructor(private documentWriter: DocumentWriter) {}
  execute(payload: CreateDocumentRequest): Promise<SerializedEntry> {
    return this.documentWriter.createDocument(payload);
  }
}
