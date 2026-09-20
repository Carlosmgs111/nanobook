import type { SerializedEntry } from "../../../document";

export type { SerializedEntry };

export interface RenderedPreview {
  Content: string;
}

export interface CachedPreview {
  rendered: RenderedPreview;
  source: SerializedEntry;
}
