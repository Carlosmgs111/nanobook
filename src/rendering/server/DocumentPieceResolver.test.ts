import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BLOCK_END_COMMENT, blockStartComment } from "../shared/componentBlocks/blockMarker";
import type { ComponentBlockDefinition } from "../shared/componentBlocks/ComponentBlockDefinition";
import { DocumentPieceResolver } from "./DocumentPieceResolver";

const counter: ComponentBlockDefinition = {
  name: "counter-demo",
  component: "/src/application/browser/components/CounterDemo/CounterDemo.astro",
  props: z.object({ label: z.string().default("Contador"), start: z.number().int().default(0) }),
};

const definitions = new Map([[counter.name, counter]]);

function block(name: string, props: unknown, inner = '<div class="component-block"><pre>fallback</pre></div>'): string {
  return `<!--${blockStartComment(name, props)}-->${inner}<!--${BLOCK_END_COMMENT}-->`;
}

function resolve(
  html: string,
  overrides: { findDefinition?: (name: string) => ComponentBlockDefinition | undefined; onInvalidProps?: (name: string) => void } = {},
) {
  const find = overrides.findDefinition ?? ((name: string) => definitions.get(name));
  return new DocumentPieceResolver({ find }).resolve(html, overrides.onInvalidProps);
}

describe("DocumentPieceResolver", () => {
  it("returns plain html as a single piece", () => {
    expect(resolve("<p>hola</p>")).toEqual([{ kind: "html", html: "<p>hola</p>" }]);
  });

  it("turns a registered block with valid props into an island", () => {
    expect(resolve(block("counter-demo", { label: "Clics", start: 3 }))).toEqual([
      { kind: "island", name: "counter-demo", component: counter.component, props: { label: "Clics", start: 3 } },
    ]);
  });

  it("passes the validated props, with defaults applied, to the island", () => {
    const [piece] = resolve(block("counter-demo", {}));

    expect(piece).toEqual({ kind: "island", name: "counter-demo", component: counter.component, props: { label: "Contador", start: 0 } });
  });

  it("keeps document order between html and islands", () => {
    const html = `<p>a</p>${block("counter-demo", { start: 1 })}<p>b</p>${block("counter-demo", { start: 2 })}<p>c</p>`;

    expect(resolve(html).map((piece) => piece.kind)).toEqual(["html", "island", "html", "island", "html"]);
  });

  it("falls back to the mount point for a block the host cannot render", () => {
    const html = block("price-chart", { height: 360 }, '<div class="component-block" data-component="price-chart"></div>');

    expect(resolve(html)).toEqual([
      { kind: "html", html: '<div class="component-block" data-component="price-chart"></div>' },
    ]);
  });

  it("falls back when the name is rendered by the host but has no definition", () => {
    const html = block("counter-demo", { start: 1 });

    expect(resolve(html, { findDefinition: () => undefined })).toEqual([
      { kind: "html", html: '<div class="component-block"><pre>fallback</pre></div>' },
    ]);
  });

  it("falls back and reports a block whose props no longer validate", () => {
    const onInvalidProps = vi.fn();

    const pieces = resolve(block("counter-demo", { start: "no es un número" }), { onInvalidProps });

    expect(pieces).toEqual([{ kind: "html", html: '<div class="component-block"><pre>fallback</pre></div>' }]);
    expect(onInvalidProps).toHaveBeenCalledWith("counter-demo");
  });

  it("does not report blocks that simply are not rendered by the host", () => {
    const onInvalidProps = vi.fn();

    resolve(block("price-chart", {}), { onInvalidProps });

    expect(onInvalidProps).not.toHaveBeenCalled();
  });
});
