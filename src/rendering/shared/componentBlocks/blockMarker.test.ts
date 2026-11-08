import { describe, expect, it } from "vitest";
import { BLOCK_START, blockStartComment, decodeBlockHeader } from "./blockMarker";

/** Texto entre `<!--nb:block-start ` y `-->`, tal como lo ve el segmentador. */
function headerOf(name: string, props: unknown): string {
  const html = `<!--${blockStartComment(name, props)}-->`;
  return html.slice(BLOCK_START.length, -"-->".length);
}

describe("blockMarker", () => {
  it("round-trips a name and props through the header", () => {
    const props = { label: "Clics", start: 3, nested: { list: [1, 2, 3], flag: true } };

    expect(decodeBlockHeader(headerOf("counter-demo", props))).toEqual({ name: "counter-demo", props });
  });

  it("round-trips accents, emoji and quotes", () => {
    const props = { text: 'Cotización "alta" 📈 — año' };

    expect(decodeBlockHeader(headerOf("quote-box", props))?.props).toEqual(props);
  });

  it("emits a comment body that cannot close the comment early", () => {
    const body = blockStartComment("counter-demo", { a: ">", b: "<!--", c: "-->" });

    expect(body.startsWith("nb:block-start counter-demo ")).toBe(true);
    expect(body).not.toMatch(/[<>"'&\s]$/);
    expect(body.slice("nb:block-start counter-demo ".length)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a header without a payload", () => {
    expect(decodeBlockHeader("counter-demo")).toBeUndefined();
    expect(decodeBlockHeader("")).toBeUndefined();
  });

  it("rejects names outside the allowed pattern", () => {
    const payload = headerOf("x", {}).split(" ")[1];

    expect(decodeBlockHeader(`Counter ${payload}`)).toBeUndefined();
    expect(decodeBlockHeader(`1counter ${payload}`)).toBeUndefined();
    expect(decodeBlockHeader(`coun_ter ${payload}`)).toBeUndefined();
  });

  it("rejects a payload that is not valid base64url", () => {
    expect(decodeBlockHeader("counter-demo !!!")).toBeUndefined();
  });

  it("rejects a payload that is base64url but not JSON", () => {
    const notJson = btoa("esto no es json").replaceAll("=", "");

    expect(decodeBlockHeader(`counter-demo ${notJson}`)).toBeUndefined();
  });
});
