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
interface ConfirmRenderedPreviewInput {
  savedDocument: SerializedEntry | null;
  renderedSource: SerializedEntry | null;
  rendered: RenderedPreview | null;
}

export function confirmRenderedPreview({
  savedDocument,
  renderedSource,
  rendered,
}: ConfirmRenderedPreviewInput): RenderedPreview | null {
  if (!savedDocument || !renderedSource || !rendered) return null;

  return JSON.stringify(savedDocument) === JSON.stringify(renderedSource)
    ? rendered
    : null;
}
