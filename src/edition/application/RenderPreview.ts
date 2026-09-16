import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { RenderedPreview } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { PreviewRenderer } from "../domain/ports/PreviewRenderer";
import type { EditionStorageError, EditionRenderError } from "../domain/errors";

export type RenderPreviewError = EditionStorageError | EditionRenderError;

export class RenderPreview {
  constructor(
    private storage: DocumentStorage,
    private renderer: PreviewRenderer
  ) {}

  async execute(
    document: SerializedEntry
  ): Promise<Result<RenderPreviewError, RenderedPreview | null>> {
    const pendingResult = this.storage.loadPendingDocument();
    if (!pendingResult.isSuccess) return Result.fail(pendingResult.getError());

    const pending = pendingResult.getValue();
    if (pending && sameDocument(pending, document)) {
      return Result.ok(null);
    }

    const cachedResult = this.loadCachedPreview(document);
    if (!cachedResult.isSuccess) return Result.fail(cachedResult.getError());
    if (cachedResult.getValue()) {
      return Result.ok(cachedResult.getValue());
    }

    const savePendingResult = this.storage.savePendingDocument(document);
    if (!savePendingResult.isSuccess) {
      this.storage.clearPendingDocument();
      return Result.fail(savePendingResult.getError());
    }

    try {
      const renderResult = await this.renderer.render(document);
      if (!renderResult.isSuccess) {
        return Result.fail(renderResult.getError());
      }
      const rendered = renderResult.getValue();

      const currentStagedResult = this.storage.loadStagedDocument();
      if (!currentStagedResult.isSuccess) {
        return Result.fail(currentStagedResult.getError());
      }
      const currentStaged = currentStagedResult.getValue();
      if (currentStaged && !sameDocument(currentStaged, document)) {
        return Result.ok(null);
      }

      const saveRenderedResult = this.storage.saveRenderedDocument(rendered);
      if (!saveRenderedResult.isSuccess) {
        return Result.fail(saveRenderedResult.getError());
      }

      const saveSourceResult = this.storage.saveRenderedSource(document);
      if (!saveSourceResult.isSuccess) {
        return Result.fail(saveSourceResult.getError());
      }

      return Result.ok(rendered);
    } finally {
      this.storage.clearPendingDocument();
    }
  }

  private loadCachedPreview(
    document: SerializedEntry
  ): Result<EditionStorageError, RenderedPreview | null> {
    const sourceResult = this.storage.loadRenderedSource();
    if (!sourceResult.isSuccess) return sourceResult;

    const renderedResult = this.storage.loadRenderedDocument();
    if (!renderedResult.isSuccess) return renderedResult;

    const source = sourceResult.getValue();
    const rendered = renderedResult.getValue();

    if (source && rendered && sameDocument(source, document)) {
      return Result.ok(rendered);
    }

    return Result.ok(null);
  }
}

function sameDocument(
  a: SerializedEntry,
  b: SerializedEntry
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
