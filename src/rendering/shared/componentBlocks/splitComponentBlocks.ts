import { BLOCK_END, BLOCK_START, decodeBlockHeader } from "./blockMarker";
import type { BlockSegment } from "./BlockSegment";

const COMMENT_END = "-->";

/**
 * Parte el HTML renderizado en segmentos ordenados usando los marcadores que
 * emite la extensión de bloques. Es una función pura de texto: no lanza nunca
 * y todo lo que no sea un marcador legible y completo queda como HTML.
 */
export function splitComponentBlocks(html: string): BlockSegment[] {
  const segments: BlockSegment[] = [];
  let cursor = 0; // inicio del HTML todavía sin emitir
  let search = 0; // desde dónde seguir buscando marcadores

  for (;;) {
    const start = html.indexOf(BLOCK_START, search);
    if (start === -1) break;
    const headerEnd = html.indexOf(COMMENT_END, start);
    if (headerEnd === -1) break;
    const end = html.indexOf(BLOCK_END, headerEnd);
    if (end === -1) break;

    const after = end + BLOCK_END.length;
    const block = decodeBlockHeader(html.slice(start + BLOCK_START.length, headerEnd));
    if (!block) {
      search = after; // ilegible: se queda como HTML
      continue;
    }

    if (start > cursor) segments.push({ kind: "html", html: html.slice(cursor, start) });
    segments.push({
      kind: "block",
      name: block.name,
      props: block.props,
      fallbackHtml: html.slice(headerEnd + COMMENT_END.length, end),
    });
    cursor = search = after;
  }

  if (cursor < html.length) segments.push({ kind: "html", html: html.slice(cursor) });
  return segments;
}
