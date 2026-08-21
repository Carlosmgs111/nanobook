import type { Document } from "../../document/core/types";
import type { RenderedDocument } from "../core/types";

export type RenderRequest = {
  id: number;
  document: Document;
};

type RenderResponse = {
  id: number;
  document: RenderedDocument;
};

export class MarkdownRenderClient {
  private worker: Worker;
  private pending = new Map<number, (document: RenderedDocument) => void>();
  private nextId = 0;

  constructor() {
    this.worker = new Worker(new URL("./work.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (event: MessageEvent<RenderResponse>) => {
      const { id, document } = event.data;
      const resolve = this.pending.get(id);
      if (!resolve) return;
      this.pending.delete(id);
      resolve(document);
    };

    this.worker.onerror = (error) => {
      console.error("[MarkdownRenderClient] worker error:", error);
    };
  }

  render(document: Document): Promise<RenderedDocument> {
    const id = ++this.nextId;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ id, document });
    });
  }

  terminate(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}

export const worker = new MarkdownRenderClient();
