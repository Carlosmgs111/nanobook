import type { ComponentBlockDefinition } from "../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import { splitComponentBlocks } from "../../rendering/shared/componentBlocks/splitComponentBlocks";

/** Lo que `RenderedDocument.astro` pinta, en orden: HTML tal cual o un bloque registrado (`island`: componente Astro, con o sin hidratación). */
export type DocumentPiece =
  | { readonly kind: "html"; readonly html: string }
  | { readonly kind: "island"; readonly name: string; readonly props: Record<string, unknown> };

export interface ResolveDocumentPiecesOptions {
  readonly findDefinition: (name: string) => ComponentBlockDefinition | undefined;
  /** Se invoca cuando las props, válidas al renderizar, ya no validan al servir. */
  readonly onInvalidProps?: (name: string) => void;
}

/**
 * Decide, para cada segmento del HTML renderizado, si se pinta tal cual o como
 * bloque registrado. Las props se validan de nuevo porque llegan de HTML cacheado. Todo lo que
 * no pueda pintarse como bloque vuelve a su punto de montaje original, de modo que nunca
 * se pierde contenido ni se rompe la página.
 */
export function resolveDocumentPieces(html: string, options: ResolveDocumentPiecesOptions): DocumentPiece[] {
  return splitComponentBlocks(html).map((segment): DocumentPiece => {
    if (segment.kind === "html") return segment;

    const definition = options.findDefinition(segment.name);
    if (definition) {
      const parsed = definition.props.safeParse(segment.props);
      if (parsed.success) {
        return { kind: "island", name: segment.name, props: parsed.data as Record<string, unknown> };
      }
      options.onInvalidProps?.(segment.name);
    }
    return { kind: "html", html: segment.fallbackHtml };
  });
}
