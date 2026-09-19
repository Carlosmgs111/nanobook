import type { SerializedEntry } from "../model/StagedDocument";
import { Result } from "../../../shared/domain/Result";
import { InvalidDocumentContentError } from "../../domain/errors";

export interface DocumentContentParser {
  parse(
    base: SerializedEntry,
    fullContent: string
  ): Result<InvalidDocumentContentError, SerializedEntry>;
}
