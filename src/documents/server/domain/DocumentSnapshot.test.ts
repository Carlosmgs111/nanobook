import { describe, expect, it } from "vitest";
import { Document } from "./Document";
import {
  fromDocumentSnapshot,
  toDocumentSnapshot,
} from "./DocumentSnapshot";
import type { DocumentParser } from "./ports/DocumentParser";

const parser: DocumentParser = { parseDocument: () => ({ headings: [] }) };

describe("DocumentSnapshot", () => {
  const document = Document.create(
    "guides/index",
    {
      id: "doc-guides",
      title: "Guides",
      description: "Documentation",
      ownerId: "owner-1",
      author: "Owner",
      tags: ["guide"],
      ref: "./source.md",
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      updatedAt: new Date("2026-11-01T12:30:00.000Z"),
    },
    "# Guides",
    parser,
    "---\ntitle: Guides\n---\n",
    "doc-guides",
    4,
  ).getValue();

  it("restores source content, metadata, frontmatter, identity and revision", () => {
    const restored = fromDocumentSnapshot(toDocumentSnapshot(document), parser);

    expect(restored?.parse()).toMatchObject({
      documentId: "doc-guides",
      revision: 4,
      path: "guides/index",
      content: "# Guides",
      rawFrontmatter: "---\ntitle: Guides\n---\n",
      metadata: {
        createdAt: new Date("2026-11-01T12:00:00.000Z"),
        updatedAt: new Date("2026-11-01T12:30:00.000Z"),
      },
    });
  });

  it("rejects a snapshot with malformed dates", () => {
    const snapshot = toDocumentSnapshot(document);
    snapshot.metadata.createdAt = "not-a-date";

    expect(fromDocumentSnapshot(snapshot, parser)).toBeNull();
  });
});
