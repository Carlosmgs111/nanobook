import type { Result } from "../../../shared/domain/Result";
import type { SerializedEntry } from "../model/StagedDocument";
import type { RenderedPreview } from "../model/StagedDocument";
import type { EditionRenderError } from "../errors";

export interface PreviewRenderer {
  render(document: SerializedEntry): Promise<Result<EditionRenderError, RenderedPreview>>;
}
