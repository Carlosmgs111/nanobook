import type { Heading } from "../../lib/document";

/**
 * Resultado de renderizar un documento a HTML.
 *
 * Content es un componente de Astro; se mantiene como `any` para no
 * acoplar este tipo a la API específica de Astro.
 */
export interface RenderedDocument {
  Content: any;
  headings: Heading[];
}

/**
 * Contrato para renderizar un documento del dominio a HTML.
 *
 * Cada adapter de publicación puede implementar su propio renderer:
 * Astro Markdown, MDX, HTML directo, etc.
 */
export interface DocumentRenderer {
  render(document: { id: string; content: string }): Promise<RenderedDocument>;
}
