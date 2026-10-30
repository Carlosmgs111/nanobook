import { describe, expect, it } from "vitest";
import { Document } from "./Document";
import { DocumentId } from "./DocumentId";
import { InvalidDocumentIdError } from "./errors";

describe("Document identity", () => {
  it("keeps the internal index path and exposes its public path separately", () => {
    const result = Document.create(
      "new-dir/index",
      {
        id: "doc-index-01",
        title: "New directory",
        description: "Directory index",
        createdAt: new Date("2026-01-01"),
      },
      "# New directory"
    );

    expect(result.isSuccess).toBe(true);
    const document = result.getValue();
    expect(document.getPath()).toBe("new-dir/index");
    expect(document.getPublicPath()).toBe("new-dir");
    expect(document.getSlug()).toBe("new-dir");
    expect(document.isIndex()).toBe(true);
    expect(document.parse().path).toBe("new-dir/index");
  });

  it("requires a persisted identity", () => {
    const result = Document.create(
      "guides/cache",
      {
        title: "Cache",
        description: "Cache guide",
        createdAt: new Date("2026-01-01"),
      },
      "# Cache"
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
  });

  it("does not accept legacy path identities", () => {
    const result = DocumentId.create("legacy:guides/cache");

    expect(result.isSuccess).toBe(false);
  });
});
