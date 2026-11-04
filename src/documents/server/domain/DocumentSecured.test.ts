import { describe, expect, it } from "vitest";

import { Document } from "./Document";
import { serializeMetadata } from "./hash";
import type { DocumentMetadata } from "./types";

const base = (overrides: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  id: "doc-1",
  title: "Guía",
  description: "Descripción",
  author: "Autora",
  ownerId: "owner-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("Document secured attribute", () => {
  it("defaults to unsecured", () => {
    const document = Document.create("guia", base(), "# Guía").getValue();

    expect(document.getMetadata().secured).toBeUndefined();
  });

  it("keeps the secured flag when declared", () => {
    const document = Document.create("guia", base({ secured: true }), "# Guía").getValue();

    expect(document.getMetadata().secured).toBe(true);
  });

  it("withSecured toggles the flag preserving identity, revision and content", () => {
    const original = Document.create("guia", base(), "# Guía", null, undefined, undefined, 4).getValue();
    const at = new Date("2026-02-02T00:00:00.000Z");

    const secured = original.withSecured(true, at).getValue();
    const open = secured.withSecured(false, at).getValue();

    expect(secured.getMetadata().secured).toBe(true);
    expect(secured.getMetadata().updatedAt).toEqual(at);
    expect(secured.getDocumentId().getValue()).toBe("doc-1");
    expect(secured.getRevision()).toBe(4);
    expect(secured.getContent()).toBe("# Guía");
    expect(open.getMetadata().secured).toBeUndefined();
  });

  it("serializes the flag only when it is true", () => {
    const secured = serializeMetadata(Document.create("guia", base({ secured: true }), "").getValue().getMetadata());
    const open = serializeMetadata(Document.create("guia", base(), "").getValue().getMetadata());

    expect(JSON.parse(secured).secured).toBe(true);
    expect(JSON.parse(open)).not.toHaveProperty("secured");
  });
});
