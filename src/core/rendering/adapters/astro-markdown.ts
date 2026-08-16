import { render } from "astro:content";
import { getAstroEntries } from "../../content/astro-cache";
import type { DocumentRenderer, RenderedDocument } from "../types";

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
