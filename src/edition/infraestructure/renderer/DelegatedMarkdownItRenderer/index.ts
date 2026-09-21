import { Result } from "../../../../shared/domain/Result";
import type { PreviewRenderer } from "../../../domain/ports/PreviewRenderer";
import type { RenderedPreview } from "../../../domain/model/StagedDocument";
import { EditionRenderError } from "../../../domain/errors";
import type { RenderRequest, RenderResponse } from "./protocol";

export class DelegatedMarkdownItRenderer implements PreviewRenderer {
  private readonly worker: Worker;
  private sequence = 0;

  private readonly pending = new Map<
    number,
    {
      resolve: (result: Result<EditionRenderError, RenderedPreview>) => void;
    }
  >();

  constructor() {
    this.worker = new Worker(new URL("./worker-entry.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", this.handleMessage);
    console.log(this.worker);
  }

  render(
    content: string
  ): Promise<Result<EditionRenderError, RenderedPreview>> {
    console.log("worker", this.worker);
    const id = ++this.sequence;

    return new Promise((resolve) => {
      this.pending.set(id, { resolve });

      const request: RenderRequest = {
        id,
        content,
      };

      this.worker.postMessage(request);
    });
  }

  private handleMessage = (event: MessageEvent<RenderResponse>): void => {
    const response = event.data;
    const pending = this.pending.get(response.id);

    if (!pending) return;

    this.pending.delete(response.id);

    if (response.ok) {
      pending.resolve(Result.ok({ Content: response.html }));
      return;
    }

    pending.resolve(Result.fail(new EditionRenderError(response.error)));
  };

  dispose(): void {
    this.worker.removeEventListener("message", this.handleMessage);
    this.worker.terminate();
    this.pending.clear();
  }
}
