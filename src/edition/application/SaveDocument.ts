import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { DocumentContentParser } from "../domain/ports/DocumentContentParser";
import type { EditionStorageError, EditionRenderError } from "../domain/errors";
import { RenderPreview } from "./RenderPreview";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { PageWarmingService } from "../domain/ports/PageWarmingService";

export type SaveDocumentApi = (document: SerializedEntry) => Promise<void>;

export type SaveDocumentError =
  | EditionStorageError
  | EditionRenderError
  | Error;

export class SaveDocument {
  constructor(
    private contentParser: DocumentContentParser,
    private storage: DocumentStorage,
    private warmingService: PageWarmingService,
    private renderPreview: RenderPreview
  ) {}

  async execute(
    base: SerializedEntry,
    fullContent: string,
    saveApi: SaveDocumentApi,
    viewHref?: string
  ): Promise<Result<SaveDocumentError, void>> {
    const buildResult = this.contentParser.parse(base, fullContent);
    if (!buildResult.isSuccess) {
      return Result.fail(buildResult.getError());
    }
    const staged = buildResult.getValue();

    try {
      await saveApi(staged);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new Error(message));
    }

    const saveResult = this.storage.saveStagedDocument(staged);
    if (!saveResult.isSuccess) return saveResult;

    const clearSavedAtResult = this.storage.clearSavedAt();
    if (!clearSavedAtResult.isSuccess) return clearSavedAtResult;

    const markResult = this.storage.markSavedAt();
    if (!markResult.isSuccess) {
      return markResult;
    }

    if (viewHref) {
      const warmResult = await this.warmingService.warm(viewHref);
      if (!warmResult.isSuccess) {
        console.error(warmResult.getError());
      }
    }

    const renderResult = await this.renderPreview.execute(staged);
    if (!renderResult.isSuccess) {
      console.error(renderResult.getError());
    }

    return Result.ok();
  }
}
