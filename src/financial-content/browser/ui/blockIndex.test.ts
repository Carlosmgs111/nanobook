import { describe, expect, it } from "vitest";
import { nextBlockIndex } from "./blockIndex";

describe("nextBlockIndex", () => {
  it("counts blocks in order within one request", () => {
    const request = {};

    expect([nextBlockIndex(request), nextBlockIndex(request), nextBlockIndex(request)]).toEqual([0, 1, 2]);
  });

  it("starts again from zero for another request", () => {
    nextBlockIndex({});

    expect(nextBlockIndex({})).toBe(0);
  });
});
