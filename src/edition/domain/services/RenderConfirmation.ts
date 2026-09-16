import type { SerializedEntry } from "../model/StagedDocument";
import type { RenderedPreview } from "../model/StagedDocument";

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
