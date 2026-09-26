import { Result } from "../../shared/domain/Result";
import { DocumentChanged } from "../domain/events/DocumentChanged";
import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { RenderedPreview } from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { PreviewRenderer } from "../domain/ports/PreviewRenderer";
import type { EditionStorageError, EditionRenderError } from "../domain/errors";
import type { EventBus } from "../../shared/domain/bus/EventBus";

export type RenderPreviewError = EditionStorageError | EditionRenderError;

export class RenderPreview {
  private activeRenders = new Map<
    string,
    Promise<Result<RenderPreviewError, RenderedPreview | null>>
  >();

  constructor(
    private storage: DocumentStorage,
    private renderer: PreviewRenderer,
    private eventBus: EventBus
  ) {}

  async execute(
    documentId: string
  ): Promise<Result<RenderPreviewError, RenderedPreview | null>> {
    const stagedResult = this.storage.loadStagedDocument(documentId);
    if (!stagedResult.isSuccess) return Result.fail(stagedResult.getError());
    const staged = stagedResult.getValue();
    if (!staged) return Result.ok(null);

    const renderKey = `${documentId}:${staged.version ?? "legacy"}`;
    const activeRender = this.activeRenders.get(renderKey);
    if (activeRender) return activeRender;

    const render = this.renderPipeline(documentId, staged);
    this.activeRenders.set(renderKey, render);

    try {
      return await render;
    } finally {
      if (this.activeRenders.get(renderKey) === render) {
        this.activeRenders.delete(renderKey);
      }
    }
  }

  private async renderPipeline(
    documentId: string,
    staged: SerializedEntry
  ): Promise<Result<RenderPreviewError, RenderedPreview | null>> {
    const cachedResult = this.loadCachedPreview(documentId, staged);
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

    const currentStagedResult = this.storage.loadStagedDocument(documentId);
    if (!currentStagedResult.isSuccess) {
      return Result.fail(currentStagedResult.getError());
    }
    const currentStaged = currentStagedResult.getValue();
    if (currentStaged && !sameDocument(currentStaged, staged)) {
      return Result.ok(null);
    }

    const saveCachedResult = this.storage.saveCachedPreview(documentId, {
      rendered,
      source: staged,
    });
    if (!saveCachedResult.isSuccess) {
      return Result.fail(saveCachedResult.getError());
    }
    this.eventBus.publish(new DocumentChanged(documentId));

    return Result.ok(rendered);
  }

  private loadCachedPreview(
    documentId: string,
    document: SerializedEntry
  ): Result<EditionStorageError, RenderedPreview | null> {
    const cachedResult = this.storage.loadCachedPreview(documentId);
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
