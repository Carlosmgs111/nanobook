import type { BlockRegistry } from "../shared/componentBlocks/createBlockRegistry";
import { splitComponentBlocks } from "../shared/componentBlocks/splitComponentBlocks";

/** Lo que `RenderedDocument.astro` pinta, en orden: HTML tal cual o un bloque registrado (`island`: componente Astro, con o sin hidratación). */
export type DocumentPiece =
  | { readonly kind: "html"; readonly html: string }
  | { readonly kind: "island"; readonly name: string; readonly component: string; readonly props: Record<string, unknown> };

/**
 * Decide, para cada segmento del HTML renderizado, si se pinta tal cual o como
 * bloque registrado. Las props se validan de nuevo porque llegan de HTML cacheado. Todo lo que
 * no pueda pintarse como bloque vuelve a su punto de montaje original, de modo que nunca
 * se pierde contenido ni se rompe la página.
 */
export class DocumentPieceResolver {
  constructor(private readonly blocks: Pick<BlockRegistry, "find">) {}

  /** `onInvalidProps` se invoca cuando las props, válidas al renderizar, ya no validan al servir. */
  resolve(html: string, onInvalidProps?: (name: string) => void): DocumentPiece[] {
    return splitComponentBlocks(html).map((segment): DocumentPiece => {
      if (segment.kind === "html") return segment;

      const definition = this.blocks.find(segment.name);
      if (definition) {
        const parsed = definition.props.safeParse(segment.props);
        if (parsed.success) {
          return { kind: "island", name: segment.name, component: definition.component, props: parsed.data as Record<string, unknown> };
        }
        onInvalidProps?.(segment.name);
      }
      return { kind: "html", html: segment.fallbackHtml };
    });
  }

}
