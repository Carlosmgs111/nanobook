import { edition } from "../";

export type RenderRequest = {
  id: string;
  document: unknown;
};

export default async (e: MessageEvent<RenderRequest>) => {
  const { id, } = e.data;
  const renderedDocument = await edition.renderPreview.execute(id);
  self.postMessage({ id, document: renderedDocument });
};
