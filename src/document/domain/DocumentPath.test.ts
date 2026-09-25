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

  it("ignores references that cannot be represented as document paths", () => {
    const source = DocumentPath.create("guides/cache").getValue();

    expect(source.resolveReference("./invalid path")).toBeNull();
    expect(source.extractInternalLinkTargets("[bad](./invalid%20path)")).toEqual([]);
  });

  it("resolves the document path while ignoring anchors and query strings", () => {
    const source = DocumentPath.create("guides/cache").getValue();

    expect(source.resolveReference("../architecture#overview")?.getValue()).toBe(
      "architecture"
    );
    expect(source.resolveReference("../architecture?preview=true")?.getValue()).toBe(
      "architecture"
    );
    expect(source.resolveReference("#local-section")).toBeNull();
    expect(
      source.extractInternalLinkTargets(
        "[doc](../architecture#overview) [same](#local-section)"
      )
    ).toEqual(["architecture"]);
  });
});
