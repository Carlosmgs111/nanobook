import type {
  SerializedEntry,
  SerializedDocumentMetadata,
} from "../../../document/application/dto/SerializedEntry";

export type { SerializedEntry, SerializedDocumentMetadata };

export interface RenderedPreview {
  Content: string;
}

export interface CachedPreview {
  rendered: RenderedPreview;
  source: SerializedEntry;
}
