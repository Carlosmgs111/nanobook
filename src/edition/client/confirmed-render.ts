import type { SerializedEntry } from "../../document/application/dto/SerializedEntry";
import type { RenderedDocument } from "../../publishing/domain/render";

interface ConfirmedRenderedDocumentInput {
  savedDocument: SerializedEntry | null;
  renderedSource: SerializedEntry | null;
  rendered: RenderedDocument | null;
}

export function selectConfirmedRenderedDocument({
  savedDocument,
  renderedSource,
  rendered,
}: ConfirmedRenderedDocumentInput): RenderedDocument | null {
  if (!savedDocument || !renderedSource || !rendered) return null;

  return JSON.stringify(savedDocument) === JSON.stringify(renderedSource)
    ? rendered
    : null;
}
