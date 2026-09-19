import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { EditionRenderError } from "../domain/errors";
import type { DocumentContentParser } from "../domain/ports/DocumentContentParser";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";

export class HandleEditorChange {
  constructor(private contentParser: DocumentContentParser, private storage: DocumentStorage) {}

  async execute(
    base: SerializedEntry,
    fullContent: string
  ): Promise<Result<EditionRenderError, SerializedEntry>> {
    const buildResult = this.contentParser.parse(base, fullContent);
    if (!buildResult.isSuccess) {
      return Result.fail(buildResult.getError());
    }
    const staged = buildResult.getValue();
    const saveResult = this.storage.saveStagedDocument(staged);
    if (!saveResult.isSuccess) return Result.fail(saveResult.getError());

    return Result.ok(staged);
  }
}
