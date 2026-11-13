import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BLOCK_END, blockStartComment } from "../shared/componentBlocks/blockMarker";
import { RenderingModule } from "./index";

const rendering = RenderingModule.create([
  {
    name: "counter-demo",
    component: "/src/demo/Counter.astro",
    props: z.object({ label: z.string().default("Contador"), start: z.number().int().default(0) }),
  },
]);
const documentHasBlocks = (html: string) => rendering.pieceResolver.resolve(html).some((piece) => piece.kind === "island");
const resolveRenderedPieces = (html: string) => rendering.pieceResolver.resolve(html);

const fallback = '<div class="component-block"></div>';
const block = (name: string, props: unknown) => `<!--${blockStartComment(name, props)}-->${fallback}${BLOCK_END}`;

describe("RenderingModule pieces", () => {
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
