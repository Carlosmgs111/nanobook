import { describe, expect, it } from "vitest";
import { BLOCK_END, blockStartComment } from "../../../rendering/shared/componentBlocks/blockMarker";
import { documentHasBlocks, resolveRenderedPieces } from "./renderedDocumentPieces";

const fallback = '<div class="component-block"></div>';
const block = (name: string, props: unknown) => `<!--${blockStartComment(name, props)}-->${fallback}${BLOCK_END}`;

describe("renderedDocumentPieces", () => {
  it("reports a document with a server-only block as having blocks", () => {
    const html = `<p>Antes</p>${block("counter-demo", { label: "A", start: 1 })}<p>Después</p>`;

    expect(documentHasBlocks(html)).toBe(true);
  });

  it("reports a document without blocks as having none", () => {
    expect(documentHasBlocks("<h1>Título</h1><p>Texto</p>")).toBe(false);
  });

  it("does not count a block whose props no longer validate, since the page shows its fallback", () => {
    const html = block("counter-demo", { start: "no-es-un-numero" });

    expect(documentHasBlocks(html)).toBe(false);
  });

  it("does not count a block with a name the host does not know", () => {
    expect(documentHasBlocks(block("desconocido", {}))).toBe(false);
  });

  it("returns pieces in document order", () => {
    const html = `<p>Antes</p>${block("counter-demo", { label: "A", start: 1 })}<p>Después</p>`;

    expect(resolveRenderedPieces(html).map((piece) => piece.kind)).toEqual(["html", "island", "html"]);
  });
});
