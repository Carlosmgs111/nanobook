import type { Result } from "../../../shared/domain/Result";
import type { MarkdownEngine } from "../../shared";
import type { PageCacheError, RenderedPageCache } from "../domain/RenderedPageCache";

/** Lo que `rendering` necesita saber de una página; quien compone adapta su documento a esta forma. */
export interface PageSource {
  readonly id: string;
  /** Cambia cuando cambia el contenido: junto con la huella del motor, decide si la caché sirve. */
  readonly contentHash: string;
  readonly content: string;
}

/**
 * Lo que `rendering` necesita de un documento para pintarlo, sin importar `documents`:
 * `parse()` devuelve su entrada (con sus `headings`) y se devuelve tal cual.
 */
export interface PageDocument<Entry extends { headings: unknown[] }> {
  getDocumentId(): { getValue(): string };
  computeContentHash(): Promise<string>;
  getContent(): string;
  parse(): Entry;
}

export interface RenderedDocumentPage<Entry extends { headings: unknown[] }> {
  rendered: { pageId: string; entry: Entry; renderedBody: string };
  headings: Entry["headings"];
  contentHash: string;
}

/** Convierte páginas en HTML reutilizando el ya renderizado cuando ni el contenido ni el motor cambiaron. */
export class PageRenderer {
  constructor(
    private readonly engine: MarkdownEngine,
    private readonly cache: RenderedPageCache,
  ) {}

  async render({ id, contentHash, content }: PageSource): Promise<string> {
    const validity = `${this.engine.fingerprint}:${contentHash}`;

    const cached = await this.cache.get(id, validity);
    if (cached) return cached.html;

    const html = await this.engine.render(content);
    await this.cache.set(id, validity, html);
    return html;
  }

  /** Lo que pintan las páginas de un documento: su entrada, sus encabezados y el HTML renderizado (cacheado). */
  async renderDocument<Entry extends { headings: unknown[] }>(document: PageDocument<Entry>): Promise<RenderedDocumentPage<Entry>> {
    const pageId = document.getDocumentId().getValue();
    const contentHash = await document.computeContentHash();
    const renderedBody = await this.render({ id: pageId, contentHash, content: document.getContent() });
    const entry = document.parse();

    return { rendered: { pageId, entry, renderedBody }, headings: entry.headings, contentHash };
  }

  invalidate(pageIds: string[]): Promise<Result<PageCacheError, void>> {
    return this.cache.invalidate(pageIds);
  }
}
