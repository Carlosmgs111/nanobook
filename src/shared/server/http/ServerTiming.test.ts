import { describe, expect, it } from "vitest";
import { formatServerTiming } from "./ServerTiming";

describe("formatServerTiming", () => {
  it("exposes named request durations rounded to one decimal place", () => {
    expect(
      formatServerTiming({ navigation: 12.34, document: 0.06, publish: 2034.56 }),
    ).toBe("navigation;dur=12.3, document;dur=0.1, publish;dur=2034.6");
  });
});
