import { describe, expect, it } from "vitest";
import { Document } from "./Document";

describe("Document", () => {
  it("serializes the proxy reference using ref", () => {
    const document = Document.create(
      "new-dir/newfile3",
      {
        id: "document-id",
        title: "New file",
        description: "New file",
        createdAt: new Date("2026-01-01"),
        ref: "/README.md",
      },
      "# Content"
    ).getValue();

    expect(document.getRawFrontmatter()).toContain('ref: "/README.md"');
    expect(document.getRawFrontmatter()).not.toContain("proxyTargetId");
    expect(document.getReference()?.getValue()).toBe("/README.md");
    expect(document.parse().ref).toBe("/README.md");
  });

  it("stores creation and update timestamps separately", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const document = Document.create(
      "timestamps",
      {
        id: "timestamps-id",
        title: "Timestamps",
        description: "Timestamps",
        createdAt,
      }
    ).getValue();

    expect(document.getMetadata().createdAt).toEqual(createdAt);
    expect(document.getMetadata().updatedAt).toEqual(createdAt);
    expect(document.getRawFrontmatter()).toContain("createdAt:");
    expect(document.getRawFrontmatter()).toContain("updatedAt:");
  });

  it("persists the stable account that owns a document", () => {
    const document = Document.create(
      "owned-document",
      {
        id: "owned-document-id",
        title: "Owned document",
        description: "Ownership test",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        // @ts-expect-error ownerId is the ownership field being introduced.
        ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
      },
    ).getValue();

    expect(document.getMetadata()).toMatchObject({
      ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
    });
    expect(document.getRawFrontmatter()).toContain(
      'ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv"',
    );
  });

  it("marks an index document as a nanobook", () => {
    const document = Document.create(
      "books/typescript-ddd/index",
      {
        id: "typescript-ddd",
        title: "TypeScript DDD",
        description: "A nanobook",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        nanobook: true,
      },
    ).getValue();

    expect(document.getMetadata()).toMatchObject({ nanobook: true });
    expect(document.getRawFrontmatter()).toContain("nanobook: true");
  });

  it("rejects the nanobook marker on a document that is not an index", () => {
    const result = Document.create(
      "books/typescript-ddd/chapter-1",
      {
        id: "chapter-1",
        title: "Chapter 1",
        description: "A chapter",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        nanobook: true,
      },
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError().message).toContain("only be marked on an index");
  });

  it("does not let the historical marker change the document version", async () => {
    const marked = Document.create(
      "index",
      {
        id: "same-version",
        title: "Root",
        description: "Root",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        nanobook: true,
      },
      "# Root",
    ).getValue();
    const plain = Document.create(
      "index",
      {
        id: "same-version",
        title: "Root",
        description: "Root",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        nanobook: false,
      },
      "# Root",
    ).getValue();

    await expect(marked.getDocumentVersion()).resolves.toBe(await plain.getDocumentVersion());
  });
});
