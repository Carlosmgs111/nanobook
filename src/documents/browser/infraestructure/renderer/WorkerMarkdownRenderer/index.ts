import { Result } from "../../../../../shared/domain/Result";
import type { PreviewRenderer } from "../../../domain/ports/PreviewRenderer";
import type { RenderedPreview } from "../../../domain/model/StagedDocument";
import { EditionRenderError } from "../../../domain/errors";
import type { RenderRequest, RenderResponse } from "./protocol";

type RenderResult = Result<EditionRenderError, RenderedPreview>;

export class WorkerMarkdownRenderer implements PreviewRenderer {
  private readonly worker: Pick<Worker, "postMessage" | "addEventListener">;
  private sequence = 0;
  private readonly pending = new Map<number, (result: RenderResult) => void>();

  constructor(worker?: Pick<Worker, "postMessage" | "addEventListener">) {
    this.worker = worker ?? new Worker(new URL("./worker-entry.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener("message", this.handleMessage);
  }

  render(content: string): Promise<RenderResult> {
    const id = ++this.sequence;

    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      const request: RenderRequest = { id, content };
      this.worker.postMessage(request);
    });
  }

  private handleMessage = (event: MessageEvent<RenderResponse>): void => {
    const response = event.data;
    const resolve = this.pending.get(response.id);
    if (!resolve) return;

    this.pending.delete(response.id);
    resolve(
      response.ok
        ? Result.ok({ Content: response.html })
        : Result.fail(new EditionRenderError(response.error))
    );
  };
}
