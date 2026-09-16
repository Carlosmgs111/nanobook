import { describe, expect, it } from "vitest";
import type { SerializedEntry } from "../../document/application/dto/SerializedEntry";
import { selectConfirmedRenderedDocument } from "./confirmed-render";

const savedDocument: SerializedEntry = {
  id: "guides/cache",
  title: "Cache",
  description: "Cache guide",
  content: "# Current version",
  rawFrontmatter: "",
  slug: "guides/cache",
  parentId: "guides",
  position: 1,
  headings: [],
  metadata: {
    title: "Cache",
    description: "Cache guide",
    date: "2026-09-15T00:00:00.000Z",
    index: false,
  },
};

describe("selectConfirmedRenderedDocument", () => {
  it("rejects HTML rendered from an older revision of the saved document", () => {
    const olderDocument = { ...savedDocument, content: "# Older version" };

    const result = selectConfirmedRenderedDocument({
      savedDocument,
      renderedSource: olderDocument,
      rendered: { Content: "<h1>Older version</h1>" },
    });

    expect(result).toBeNull();
  });

  it("accepts HTML rendered from the exact saved revision", () => {
    const result = selectConfirmedRenderedDocument({
      savedDocument,
      renderedSource: savedDocument,
      rendered: { Content: "<h1>Current version</h1>" },
    });

    expect(result).toEqual({ Content: "<h1>Current version</h1>" });
  });
});
