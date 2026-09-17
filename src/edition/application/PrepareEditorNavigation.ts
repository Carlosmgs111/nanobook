import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { EditionRenderError, EditionStorageError } from "../domain/errors";
import type { DocumentContentParser } from "../domain/ports/DocumentContentParser";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import { RenderPreview } from "./RenderPreview";
import { isInsideDocumentFlow } from "../domain/services/DocumentFlow";

export type PrepareEditorNavigationError =
  | EditionRenderError
  | EditionStorageError;

export class PrepareEditorNavigation {
  constructor(
    private contentParser: DocumentContentParser,
    private renderPreview: RenderPreview,
    private storage: DocumentStorage
  ) {}

  async execute(
    base: SerializedEntry,
    fullContent: string,
    documentId: string,
    destination?: URL
  ): Promise<Result<PrepareEditorNavigationError, void>> {
    const currentStagedResult = this.contentParser.parse(base, fullContent);
    if (!currentStagedResult.isSuccess) {
      return Result.fail(currentStagedResult.getError());
    }
    const staged = currentStagedResult.getValue();

    const saveResult = this.storage.saveStagedDocument(staged);
    if (!saveResult.isSuccess) return saveResult;

    const clearSavedAtResult = this.storage.clearSavedAt();
    if (!clearSavedAtResult.isSuccess) return clearSavedAtResult;

    const renderResult = await this.renderPreview.execute(staged);
    if (!renderResult.isSuccess) {
      console.error(renderResult.getError());
    }

    if (destination && !isInsideDocumentFlow(destination, documentId)) {
      return this.storage.clearAll();
    }

    return Result.ok();
  }
}
