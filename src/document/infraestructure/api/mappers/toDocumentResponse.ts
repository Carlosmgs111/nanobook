import type { Entry } from "../../../domain/types";
import type { DocumentResponse } from "../dto/DocumentResponse";
import { serializeEntry } from "../../../application/dto/SerializedEntry";

export function toDocumentResponse(entry: Entry): DocumentResponse {
  return serializeEntry(entry);
}
