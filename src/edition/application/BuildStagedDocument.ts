import type { SerializedEntry } from "../domain/model/StagedDocument";
import { buildDocumentFromContent } from "../domain/services/DocumentContentParser";
import { InvalidDocumentContentError } from "../domain/errors";
import { Result } from "../../shared/domain/Result";

export type BuildStagedDocumentError = InvalidDocumentContentError;

export class BuildStagedDocument {
  execute(
    base: SerializedEntry,
    fullContent: string
  ): Result<BuildStagedDocumentError, SerializedEntry> {
    try {
      return Result.ok(buildDocumentFromContent(base, fullContent));
    } catch (error) {
      if (error instanceof InvalidDocumentContentError) {
        return Result.fail(error);
      }
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new InvalidDocumentContentError(message));
    }
  }
}
