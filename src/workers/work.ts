import type { RenderRequest } from ".";
import { MarkdownItRenderer } from "../core/rendering/adapters/it-mardown";

const renderer = new MarkdownItRenderer();

self.onmessage = async function (e: MessageEvent<RenderRequest>) {
  const { id, document } = e.data;
  const renderedDocument = await renderer.render(document);
  self.postMessage({ id, document: renderedDocument });
};
