import { render } from "astro:content";
import { getAstroEntries } from "../../content/astro-cache";
import type { DocumentRenderer, RenderedDocument } from "../types";

/**
 * Renderer de Markdown usando Astro.
 *
 * Responsabilidad única: convertir un documento del dominio en HTML
 * renderizado. Depende de las entradas crudas de Astro, pero no del
 * ContentRepository.
 */
export class AstroMarkdownRenderer implements DocumentRenderer {
  async render(document: {
    id: string;
    content: string;
  }): Promise<RenderedDocument> {
    const entries = await getAstroEntries();
    const entry = entries.get(document.id);

    if (!entry) {
      throw new Error(
        `Cannot render document ${document.id}: Astro entry not found`,
      );
    }

    return render(entry) as Promise<RenderedDocument>;
  }
}
