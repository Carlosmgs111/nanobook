import { describe, expect, it } from "vitest";
import { ensureDocumentIdentity } from "./migrate-document-identities";

describe("ensureDocumentIdentity", () => {
  it("inserts an identity without reformatting the document", () => {
    const source = "---\ntitle: Test\n---\n\n# Body\n";
    const result = ensureDocumentIdentity(source, () => "doc-1");

    expect(result.id).toBe("doc-1");
    expect(result.changed).toBe(true);
    expect(result.content).toBe(
      '---\nid: "doc-1"\ntitle: Test\n---\n\n# Body\n'
    );
  });

  it("preserves an existing identity", () => {
    const source = '---\nid: "doc-existing"\ntitle: Test\n---\nBody';
    const result = ensureDocumentIdentity(source, () => "should-not-be-used");

    expect(result).toEqual({
      content: source,
      id: "doc-existing",
      changed: false,
    });
  });

  it("replaces a legacy path identity with a generated stable identity", () => {
    const source = '---\nid: "legacy:guides/cache"\ntitle: Test\n---\nBody';
    const result = ensureDocumentIdentity(source, () => "doc-migrated");

    expect(result).toEqual({
      content: '---\nid: "doc-migrated"\ntitle: Test\n---\nBody',
      id: "doc-migrated",
      changed: true,
    });
  });
});
