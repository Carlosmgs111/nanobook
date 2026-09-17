import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { EditionStorageError, EditionRenderError } from "../domain/errors";
import type { DocumentContentParser } from "../domain/ports/DocumentContentParser";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";

import { RenderPreview } from "./RenderPreview";

export class HandleEditorChange {
  constructor(
    private contentParser: DocumentContentParser,
    private storage: DocumentStorage,
    private renderPreview: RenderPreview
  ) {}

  async execute(
    base: SerializedEntry,
    fullContent: string
  ): Promise<Result<EditionRenderError, void>> {
    const buildResult = this.contentParser.parse(base, fullContent);
    if (!buildResult.isSuccess) {
      return Result.fail(buildResult.getError());
    }
    const staged = buildResult.getValue();
    const saveResult = this.storage.saveStagedDocument(staged);
    if (!saveResult.isSuccess) return saveResult;

    const clearSavedAtResult = this.storage.clearSavedAt();
    if (!clearSavedAtResult.isSuccess) return clearSavedAtResult;

    const renderResult = await this.renderPreview.execute(staged);
    if (!renderResult.isSuccess) {
      return Result.fail(renderResult.getError());
    }

    return Result.ok();
  }
}
