import type { Result } from "../../../shared/domain/Result";
import type { EditionRenderError } from "../errors";

export interface PreviewRenderer {
  render(
    document: string
  ): Promise<Result<EditionRenderError, { Content: string }>>;
}
