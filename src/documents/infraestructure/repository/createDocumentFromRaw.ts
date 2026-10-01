import { Result } from "../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import type { DocumentMetadata } from "../../domain/types";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import { FrontmatterParser } from "../parse/FrontmatterParser";
import type {
  InvalidDocumentError,
  InvalidDocumentIdError,
} from "../../domain/errors";

export function createDocumentFromRaw(
  id: string,
  raw: string,
  parser: DocumentParser | null
): Result<InvalidDocumentError | InvalidDocumentIdError, Document> {
  const { data, body, rawFrontmatter } = FrontmatterParser.parseFrontmatter(raw);
  return Document.create(id, data as DocumentMetadata, body, parser, rawFrontmatter);
}
