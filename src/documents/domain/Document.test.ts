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
});
