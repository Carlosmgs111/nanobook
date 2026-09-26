import type { Result } from "../../../shared/domain/Result";
import type { SerializedEntry, CreateDocumentRequest } from "../../../document";
import type { EditionWriterError } from "../../domain/errors";

export interface DocumentWriter {
  createDocument(
    document: CreateDocumentRequest
  ): Promise<Result<EditionWriterError, SerializedEntry>>;
  updateDocument(
    documentId: string,
    document: SerializedEntry
  ): Promise<Result<EditionWriterError, SerializedEntry>>;
}
