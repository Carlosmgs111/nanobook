import type { Result } from "../../../../shared/domain/Result";
import type { EditionRenderError } from "../errors";

/** Puerto: convierte Markdown en HTML; lo aporta el compositor (en el Worker, el motor de rendering). */
export interface MarkdownEngine {
  render(source: string): Promise<string>;
}

export interface PreviewRenderer {
  render(
    document: string
  ): Promise<Result<EditionRenderError, { Content: string }>>;
}
