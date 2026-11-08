import { describe, expect, it } from "vitest";
import { assertUniqueFenceLanguages, type MarkdownExtension } from "./MarkdownExtension";

const extension = (id: string, fenceLanguages: string[]): MarkdownExtension => ({
  id,
  version: "1",
  fenceLanguages,
  transform() {},
});

describe("assertUniqueFenceLanguages", () => {
  it("accepts extensions that claim different fence languages", () => {
    expect(() =>
      assertUniqueFenceLanguages([extension("a", ["one", "two"]), extension("b", ["three"]), extension("c", [])]),
    ).not.toThrow();
  });

  it("fails naming the language and both extensions when two claim it", () => {
    expect(() =>
      assertUniqueFenceLanguages([extension("first", ["price-chart"]), extension("second", ["price-chart"])]),
    ).toThrow(/price-chart.*first.*second/s);
  });

  it("fails when one extension lists the same language twice", () => {
    expect(() => assertUniqueFenceLanguages([extension("only", ["dup", "dup"])])).toThrow(/dup.*only/s);
  });
});
