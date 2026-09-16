import type {
  SerializedEntry,
  SerializedDocumentMetadata,
} from "../../../document/application/dto/SerializedEntry";

export type { SerializedEntry, SerializedDocumentMetadata };

export interface RenderedPreview {
  Content: string;
}

export interface EditionState {
  stagedDocument: SerializedEntry | null;
  renderedDocument: RenderedPreview | null;
  renderedSource: SerializedEntry | null;
  savedAt: number | null;
}
