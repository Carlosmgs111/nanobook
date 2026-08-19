import type { Document } from "../core/content/types";
import type { RenderedDocument } from "../core/rendering/types";

export type RenderRequest = {
  id: string;
  document: Document;
};

type RenderResponse = {
  id: string;
  document: RenderedDocument;
};

export class MarkdownRenderClient {
  private pending = new Map<string, (document: RenderedDocument) => void>();
  constructor(private worker: Worker) {
    this.worker.onmessage = (event: MessageEvent<RenderResponse>) => {
      const { id, document } = event.data;
      const resolve = this.pending.get(id);
      if (!resolve) return;
      this.pending.delete(id);
      resolve(document);
    };
  }

  async render(document: Document): Promise<RenderedDocument> {
    const id = crypto.randomUUID();
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ id, document });
    });
  }
}

export const worker = new MarkdownRenderClient(
  new Worker(new URL("./work.ts", import.meta.url), {
    type: "module",
  })
);
