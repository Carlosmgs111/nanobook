import type { SerializedEntry } from "../domain/model/StagedDocument";
import type { RenderedPreview } from "../domain/model/StagedDocument";
import { confirmRenderedPreview } from "../domain/services/RenderConfirmation";

interface ConfirmRenderedPreviewInput {
  savedDocument: SerializedEntry | null;
  renderedSource: SerializedEntry | null;
  rendered: RenderedPreview | null;
}

export class ConfirmRenderedPreview {
  execute(input: ConfirmRenderedPreviewInput): RenderedPreview | null {
    return confirmRenderedPreview(input);
  }
}
