import { Result } from "../../../shared/domain/Result";
import { DocumentChanged } from "../domain/events/DocumentChanged";
import {
  sameDocument,
  type RenderedPreview,
  type SerializedEntry,
} from "../domain/model/StagedDocument";
import type { DocumentStorage } from "../domain/ports/DocumentStorage";
import type { PreviewRenderer } from "../domain/ports/PreviewRenderer";
import type { EditionStorageError, EditionRenderError } from "../domain/errors";
import type { EventBus } from "../../../shared/domain/bus/EventBus";

export type RenderPreviewError = EditionStorageError | EditionRenderError;
type RenderOutcome = Result<RenderPreviewError, RenderedPreview | null>;

export class RenderPreview {
  /** Renders en curso por documento y versión: las llamadas concurrentes los comparten. */
  private activeRenders = new Map<string, Promise<RenderOutcome>>();

  constructor(
    private storage: DocumentStorage,
    private renderer: PreviewRenderer,
    private eventBus: EventBus
  ) {}

  async execute(documentId: string): Promise<RenderOutcome> {
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
  ): Promise<RenderOutcome> {
    const cachedResult = this.storage.loadCachedPreview(documentId);
    if (!cachedResult.isSuccess) return Result.fail(cachedResult.getError());
    const cached = cachedResult.getValue();
    if (cached && sameDocument(cached.source, staged)) {
      return Result.ok(cached.rendered);
    }

    const renderResult = await this.renderer.render(staged.content);
    if (!renderResult.isSuccess) return Result.fail(renderResult.getError());
    const rendered = renderResult.getValue();

    // Si el borrador cambió mientras se renderizaba, el resultado está obsoleto.
    const currentResult = this.storage.loadStagedDocument(documentId);
    if (!currentResult.isSuccess) return Result.fail(currentResult.getError());
    const current = currentResult.getValue();
    if (current && !sameDocument(current, staged)) return Result.ok(null);

    const saveResult = this.storage.saveCachedPreview(documentId, {
      rendered,
      source: staged,
    });
    if (!saveResult.isSuccess) return Result.fail(saveResult.getError());
    this.eventBus.publish(new DocumentChanged(documentId));

    return Result.ok(rendered);
  }
}
