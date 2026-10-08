import { describe, expect, it } from "vitest";

import { assignDocumentOwner } from "./migrate-document-ownership";

describe("assignDocumentOwner", () => {
  it("adds the owner immediately after the stable document identity", () => {
    const source = '---\nid: "doc-1"\ntitle: Test\n---\nBody';

    const result = assignDocumentOwner(
      source,
      "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
    );

    expect(result).toEqual({
      changed: true,
      content:
        '---\nid: "doc-1"\nownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"\ntitle: Test\n---\nBody',
    });
  });

  it("reassigns a document whose owner is different", () => {
    const source =
      '---\nid: "doc-1"\nownerId: "previous-owner"\ntitle: Test\n---\nBody';

    const result = assignDocumentOwner(
      source,
      "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
    );

    expect(result.content).toContain(
      'ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"',
    );
    expect(result.content).not.toContain("previous-owner");
    expect(result.changed).toBe(true);
  });

  it("does not rewrite a document already assigned to the target owner", () => {
    const source =
      '---\nid: "doc-1"\nownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"\ntitle: Test\n---\nBody';

    expect(
      assignDocumentOwner(source, "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"),
    ).toEqual({ changed: false, content: source });
  });
});
