import { Result } from "../../../shared/domain/Result";
import type { DocumentWriter } from "./ports/DocumentWriter";
import type { SerializedEntry, CreateDocumentRequest } from "../../server";
import type { EditionWriterError } from "../domain/errors";

export class CreateDocument {
  constructor(private documentWriter: DocumentWriter) {}
  execute(
    payload: CreateDocumentRequest
  ): Promise<Result<EditionWriterError, SerializedEntry>> {
    return this.documentWriter.createDocument(payload);
  }
}
