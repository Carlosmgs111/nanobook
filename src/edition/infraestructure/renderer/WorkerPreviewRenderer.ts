import { Result } from "../../../shared/domain/Result";
import type { PreviewRenderer } from "../../domain/ports/PreviewRenderer";
import type { SerializedEntry } from "../../domain/model/StagedDocument";
import type { RenderedPreview } from "../../domain/model/StagedDocument";
import { EditionRenderError } from "../../domain/errors";

async function loadWorker() {
  const { worker } = await import("../../../publishing/client/workers");
  return worker;
}

export class WorkerPreviewRenderer implements PreviewRenderer {
  async render(
    document: SerializedEntry
  ): Promise<Result<EditionRenderError, RenderedPreview>> {
    try {
      const worker = await loadWorker();
      const rendered = await worker.render(document);
      return Result.ok(rendered as RenderedPreview);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new EditionRenderError(message));
    }
  }
}
