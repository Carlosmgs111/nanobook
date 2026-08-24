import type { RenderRequest } from ".";
import { MarkdownItRenderer } from "../../adapters/markdown/markdown-it";

const renderer = new MarkdownItRenderer();

self.onmessage = async function (e: MessageEvent<RenderRequest>) {
  const { id, document } = e.data;
  const renderedDocument = await renderer.render(document);
  self.postMessage({ id, document: renderedDocument });
};
