import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { EditionRenderError } from "../domain/errors";
import type { DocumentContentParser } from "../domain/ports/DocumentContentParser";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";

export class HandleEditorChange {
  constructor(private contentParser: DocumentContentParser, private storage: DocumentStorage) {}

  async execute(
    base: SerializedEntry,
    fullContent: string,
    preserveSourceBody = false
  ): Promise<Result<EditionRenderError, SerializedEntry>> {
    const buildResult = this.contentParser.parse(base, fullContent);
    if (!buildResult.isSuccess) {
      return Result.fail(buildResult.getError());
    }
    const parsed = buildResult.getValue();
    const staged = preserveSourceBody
      ? { ...parsed, content: base.content }
      : parsed;
    const documentId = staged.documentId;
    const saveResult = this.storage.saveStagedDocument(documentId, staged);
    if (!saveResult.isSuccess) return Result.fail(saveResult.getError());

    const clearConfirmationResult = this.storage.clearConfirmedDocument(documentId);
    if (!clearConfirmationResult.isSuccess) {
      return Result.fail(clearConfirmationResult.getError());
    }

    return Result.ok(staged);
  }
}
