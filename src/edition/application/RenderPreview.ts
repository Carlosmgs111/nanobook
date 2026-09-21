import { Result } from "../../shared/domain/Result";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { RenderedPreview } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { PreviewRenderer } from "../domain/ports/PreviewRenderer";
import type { EditionStorageError, EditionRenderError } from "../domain/errors";

export type RenderPreviewError = EditionStorageError | EditionRenderError;

export class RenderPreview {
  private isRendering = false;

  constructor(
    private storage: DocumentStorage,
    private renderer: PreviewRenderer
  ) {}

  async execute(
    documentId: string
  ): Promise<Result<RenderPreviewError, RenderedPreview | null>> {
    if (this.isRendering) {
      return Result.ok(null);
    }

    this.isRendering = true;
    const result = await this.renderPipeline(documentId);
    this.isRendering = false;

    return result;
  }

  private async renderPipeline(
    documentId: string
  ): Promise<Result<RenderPreviewError, RenderedPreview | null>> {
    const stagedResult = this.storage.loadStagedDocument();
    if (!stagedResult.isSuccess) {
      return Result.fail(stagedResult.getError());
    }
    const staged = stagedResult.getValue();
    if (!staged || staged.id !== documentId) {
      return Result.ok(null);
    }

    const cachedResult = this.loadCachedPreview(staged);
    if (!cachedResult.isSuccess) {
      return Result.fail(cachedResult.getError());
    }
    if (cachedResult.getValue()) {
      return Result.ok(cachedResult.getValue());
    }
    const renderResult = await this.renderer.render(staged.content);
    if (!renderResult.isSuccess) {
      return Result.fail(renderResult.getError());
    }
    const rendered = renderResult.getValue();
    console.log({ rendered });
    const currentStagedResult = this.storage.loadStagedDocument();
    if (!currentStagedResult.isSuccess) {
      return Result.fail(currentStagedResult.getError());
    }
    const currentStaged = currentStagedResult.getValue();
    if (currentStaged && !sameDocument(currentStaged, staged)) {
      return Result.ok(null);
    }

    const saveCachedResult = this.storage.saveCachedPreview({
      rendered,
      source: staged,
    });
    if (!saveCachedResult.isSuccess) {
      return Result.fail(saveCachedResult.getError());
    }

    return Result.ok(rendered);
  }

  private loadCachedPreview(
    document: SerializedEntry
  ): Result<EditionStorageError, RenderedPreview | null> {
    const cachedResult = this.storage.loadCachedPreview();
    if (!cachedResult.isSuccess) return Result.fail(cachedResult.getError());

    const cached = cachedResult.getValue();
    if (cached && sameDocument(cached.source, document)) {
      return Result.ok(cached.rendered);
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
