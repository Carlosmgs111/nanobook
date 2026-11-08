import { describe, expect, it } from "vitest";
import { BLOCK_END_COMMENT, blockStartComment } from "./blockMarker";
import { splitComponentBlocks } from "./splitComponentBlocks";

function block(name: string, props: unknown, inner = `<pre>${name}</pre>`): string {
  return `<!--${blockStartComment(name, props)}--><div class="component-block">${inner}</div><!--${BLOCK_END_COMMENT}-->`;
}

describe("splitComponentBlocks", () => {
  it("returns no segments for an empty document", () => {
    expect(splitComponentBlocks("")).toEqual([]);
  });

  it("returns a single html segment when there are no markers", () => {
    const html = "<h1>Hola</h1><p>texto</p>";

    expect(splitComponentBlocks(html)).toEqual([{ kind: "html", html }]);
  });

  it("splits html and blocks in document order", () => {
    const html = `<p>a</p>${block("one-block", { n: 1 })}<p>b</p>${block("two-block", { n: 2 })}<p>c</p>`;

    expect(splitComponentBlocks(html).map((segment) => (segment.kind === "html" ? segment.html : segment.name))).toEqual([
      "<p>a</p>",
      "one-block",
      "<p>b</p>",
      "two-block",
      "<p>c</p>",
    ]);
  });

  it("decodes the props of each block", () => {
    const [segment] = splitComponentBlocks(block("one-block", { label: "hola", n: 3 }));

    expect(segment).toMatchObject({ kind: "block", name: "one-block", props: { label: "hola", n: 3 } });
  });

  it("keeps the mount point between the markers as fallback html", () => {
    const [segment] = splitComponentBlocks(block("one-block", {}, "<pre>original</pre>"));

    expect(segment).toMatchObject({
      kind: "block",
      fallbackHtml: '<div class="component-block"><pre>original</pre></div>',
    });
  });

  it("handles a block at the very start and at the very end", () => {
    const segments = splitComponentBlocks(`${block("one-block", {})}<p>medio</p>${block("two-block", {})}`);

    expect(segments.map((segment) => segment.kind)).toEqual(["block", "html", "block"]);
  });

  it("handles consecutive blocks with nothing between them", () => {
    const segments = splitComponentBlocks(`${block("one-block", {})}${block("two-block", {})}`);

    expect(segments.map((segment) => segment.kind)).toEqual(["block", "block"]);
  });

  it("reproduces the original html minus the marker comments", () => {
    const html = `<p>a</p>${block("one-block", { n: 1 })}<p>b</p>${block("two-block", { n: 2 })}`;
    const rebuilt = splitComponentBlocks(html)
      .map((segment) => (segment.kind === "html" ? segment.html : segment.fallbackHtml))
      .join("");

    const withoutMarkers = html.replace(/<!--nb:block-(?:start [^>]*|end)-->/g, "");
    expect(rebuilt).toBe(withoutMarkers);
  });

  it("leaves a marker with an unreadable header as plain html", () => {
    const html = `<p>a</p><!--nb:block-start one-block !!!--><div>x</div><!--${BLOCK_END_COMMENT}--><p>b</p>`;

    expect(splitComponentBlocks(html)).toEqual([{ kind: "html", html }]);
  });

  it("still finds a valid block that follows an unreadable marker", () => {
    const broken = `<!--nb:block-start one-block !!!--><div>x</div><!--${BLOCK_END_COMMENT}-->`;
    const segments = splitComponentBlocks(`${broken}${block("two-block", {})}`);

    expect(segments.map((segment) => segment.kind)).toEqual(["html", "block"]);
    expect(segments[0]).toEqual({ kind: "html", html: broken });
  });

  it("treats a start marker without an end marker as plain html", () => {
    const html = `<p>a</p><!--${blockStartComment("one-block", {})}--><div>x</div>`;

    expect(splitComponentBlocks(html)).toEqual([{ kind: "html", html }]);
  });

  it("does not throw on a stray comment terminator", () => {
    const html = "<p>a --> b</p><!--nb:block-start";

    expect(splitComponentBlocks(html)).toEqual([{ kind: "html", html }]);
  });
});
