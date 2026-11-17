import { describe, expect, it } from "vitest";
import { hideProtectedFrontmatter } from "./protectedFrontmatter";

describe("hideProtectedFrontmatter", () => {
  it("oculta identidad, auditoría y protección y conserva los campos editables", () => {
    const result = hideProtectedFrontmatter(
      '---\nid: "doc-1"\nauthor: "Author"\nownerId: u1\nsecured: true\ncreatedAt: 2024-01-01\nupdatedAt: 2024-01-02\ntitle: "Title"\n---\n'
    );

    for (const field of ["id", "author", "ownerId", "secured", "createdAt", "updatedAt"]) {
      expect(result).not.toContain(`${field}:`);
    }
    expect(result).toContain("title: Title");
  });

  it("devuelve el texto original si no hay frontmatter o es inválido", () => {
    const invalid = "---\na: [\n---\n";
    expect(hideProtectedFrontmatter("sin frontmatter")).toBe("sin frontmatter");
    expect(hideProtectedFrontmatter(invalid)).toBe(invalid);
  });
});
