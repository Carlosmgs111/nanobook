import { describe, expect, it } from "vitest";
import { hideProtectedFrontmatter } from "./protectedFrontmatter";

describe("hideProtectedFrontmatter", () => {
  it("removes identity and audit fields while preserving editable metadata", () => {
    const result = hideProtectedFrontmatter(
      '---\nid: "doc-1"\nauthor: "Author"\ncreatedAt: 2024-01-01\nupdatedAt: 2024-01-02\ntitle: "Title"\n---\n'
    );

    expect(result).not.toContain("id:");
    expect(result).not.toContain("author:");
    expect(result).not.toContain("createdAt:");
    expect(result).not.toContain("updatedAt:");
    expect(result).toContain("title: Title");
  });
});
