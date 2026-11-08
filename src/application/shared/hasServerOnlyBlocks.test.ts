import { describe, expect, it } from "vitest";
import { BLOCK_END_COMMENT, blockStartComment } from "../../rendering/shared/componentBlocks/blockMarker";
import { hasServerOnlyBlocks } from "./hasServerOnlyBlocks";

const islands = new Set(["price-chart-island", "counter-demo"]);

function block(name: string): string {
  return `<!--${blockStartComment(name, {})}--><div class="component-block"><pre>${name}</pre></div><!--${BLOCK_END_COMMENT}-->`;
}

describe("hasServerOnlyBlocks", () => {
  it("is false for html without blocks", () => {
    expect(hasServerOnlyBlocks("<h1>Hola</h1><p>texto</p>", islands)).toBe(false);
  });

  it("is true when a root block is rendered as an island by the server", () => {
    expect(hasServerOnlyBlocks(`<p>a</p>${block("price-chart-island")}<p>b</p>`, islands)).toBe(true);
  });

  it("is true when only one of several blocks is an island", () => {
    expect(hasServerOnlyBlocks(`${block("price-chart")}${block("counter-demo")}`, islands)).toBe(true);
  });

  it("is false for blocks the browser can mount by itself (client-only components)", () => {
    expect(hasServerOnlyBlocks(`${block("price-chart")}${block("financial-chart")}`, islands)).toBe(false);
  });

  it("is false for a nested island fence, which has no markers and is never an island", () => {
    const nested = '<ul><li><div class="component-block" data-component="counter-demo"><pre>x</pre></div></li></ul>';

    expect(hasServerOnlyBlocks(nested, islands)).toBe(false);
  });

  it("is false when the server renders no islands at all", () => {
    expect(hasServerOnlyBlocks(block("counter-demo"), new Set())).toBe(false);
  });
});
