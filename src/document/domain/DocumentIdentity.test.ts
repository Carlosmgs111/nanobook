import { describe, expect, it } from "vitest";
import { Document } from "./Document";

describe("Document identity and version", () => {
  it("keeps stable identity separate from mutable path", async () => {
    const result = Document.create(
      "guides/cache",
      {
        id: "doc-cache-01",
        title: "Cache",
        description: "Cache guide",
        date: new Date("2026-01-01"),
        index: false,
      },
      "# Cache"
    );

    expect(result.isSuccess).toBe(true);
    const document = result.getValue();
    expect(document.getDocumentId().getValue()).toBe("doc-cache-01");
    expect(document.getPath()).toBe("guides/cache");

    const hash = await document.hashDocument();
    expect(hash.documentId).toBe("doc-cache-01");
    expect(hash.path).toBe("guides/cache");
    expect(hash.version).toMatch(/^[a-f0-9]{64}$/);
  });

  it("preserves identity and version when the document moves", async () => {
    const result = Document.create(
      "guides/cache",
      {
        id: "doc-cache-01",
        title: "Cache",
        description: "Cache guide",
        date: new Date("2026-01-01"),
        index: false,
      },
      "# Cache"
    );
    const document = result.getValue();
    const before = await document.getDocumentVersion();
    const moved = document.moveTo("architecture/cache");

    expect(moved.isSuccess).toBe(true);
    expect(moved.getValue().getDocumentId().getValue()).toBe("doc-cache-01");
    expect(moved.getValue().getPath()).toBe("architecture/cache");
    await expect(moved.getValue().getDocumentVersion()).resolves.toBe(before);
  });
});
