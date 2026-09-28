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
        date: new Date("2026-01-01"),
        ref: "/README.md",
      },
      "# Content"
    ).getValue();

    expect(document.getRawFrontmatter()).toContain('ref: "/README.md"');
    expect(document.getRawFrontmatter()).not.toContain("proxyTargetId");
    expect(document.getReference()?.getValue()).toBe("/README.md");
    expect(document.parse().ref).toBe("/README.md");
  });
});
