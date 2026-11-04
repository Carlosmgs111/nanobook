import { describe, expect, it } from "vitest";

import { Document } from "../domain/Document";
import { DocumentId } from "../domain/DocumentId";
import type { ContentEntry } from "../domain/types";
import type { ReferenceResolver } from "../domain/reference/types";
import { ProxyParser } from "./ProxyParser";

describe("ProxyParser and protected targets", () => {
  it("makes the resolved proxy inherit the identity and protection of its target", async () => {
    const source = Document.create(
      "atajo",
      {
        id: "source-id",
        title: "Atajo",
        description: "Proxy",
        author: "Autora",
        ownerId: "owner-1",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
        ref: "./secreto",
      },
      "",
    ).getValue();
    const target: ContentEntry = {
      id: DocumentId.create("target-id").getValue(),
      data: {
        id: "target-id",
        title: "Secreto",
        description: "Contenido",
        author: "Autora",
        ownerId: "owner-1",
        secured: true,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      body: "# Reservado",
    };
    const resolver: ReferenceResolver = { resolve: async () => target };

    const resolved = await new ProxyParser(resolver).parseProxy("book-a", source);

    expect(resolved?.getMetadata().secured).toBe(true);
    expect(resolved?.getDocumentId().getValue()).toBe("target-id");
    expect(resolved?.getContent()).toBe("# Reservado");
  });
});
