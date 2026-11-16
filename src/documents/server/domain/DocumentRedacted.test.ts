import { describe, expect, it } from "vitest";

import { Document } from "./Document";

describe("Document.redacted", () => {
  const full = Document.create(
    "guia",
    {
      id: "doc-1",
      title: "Guía interna",
      description: "Resumen sensible",
      author: "Autora",
      ownerId: "owner-1",
      tags: ["secreto"],
      cover: "https://example.com/cover.png",
      ref: "./otro.md",
      secured: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    },
    "# Contenido secreto",
    null,
    undefined,
    undefined,
    7,
  ).getValue();

  it("keeps identity, path, title, revision and the lock flag", () => {
    const redacted = full.redacted().parse();

    expect(redacted.documentId).toBe("doc-1");
    expect(redacted.path).toBe("guia");
    expect(redacted.title).toBe("Guía interna");
    expect(redacted.revision).toBe(7);
    expect(redacted.metadata.secured).toBe(true);
  });

  it("drops body, description, tags, cover, ref, owner and author", () => {
    const redacted = full.redacted().parse();

    expect(redacted.content).toBe("");
    expect(redacted.description).toBe("");
    expect(redacted.metadata.tags).toEqual([]);
    expect(redacted.metadata.cover).toBeUndefined();
    expect(redacted.metadata.ref).toBeUndefined();
    expect(redacted.ref).toBeUndefined();
    expect(redacted.metadata.ownerId).toBeUndefined();
    expect(redacted.metadata.author).toBe("Nanobook");
    expect(redacted.rawFrontmatter).not.toContain("Resumen sensible");
    expect(redacted.rawFrontmatter).not.toContain("owner-1");
  });
});
