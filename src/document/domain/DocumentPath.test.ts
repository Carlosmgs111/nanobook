import { describe, expect, it } from "vitest";
import { DocumentPath } from "./DocumentPath";

describe("DocumentPath", () => {
  it("normalizes markdown paths and exposes the parent path", () => {
    const result = DocumentPath.create("/guides/cache.md");

    expect(result.isSuccess).toBe(true);
    const path = result.getValue();
    expect(path.getValue()).toBe("guides/cache");
    expect(path.getParentPath()?.getValue()).toBe("guides");
  });

  it("keeps index paths as directory paths", () => {
    const result = DocumentPath.create("guides/index");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().normalized()).toBe("guides");
    expect(result.getValue().getParentPath()?.getValue()).toBe("index");
  });
});
