import { describe, expect, it, vi, type Mock } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { DocumentInput } from "./dto/DocumentInput";
import { buildDocumentInput, createEventBus, createRepository } from "./test/factories";
import { UpdateDocument } from "./UpdateDocument";

function existingSecuredDocument() {
  return Document.create(
    "intro",
    {
      id: "doc-1",
      title: "Intro",
      description: "Descripción",
      author: "Autora",
      ownerId: "owner-1",
      secured: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    "# Antiguo",
    null,
    undefined,
    undefined,
    3,
  ).getValue();
}

describe("UpdateDocument and the secured flag", () => {
  it("preserves secured when the document is edited", async () => {
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(existingSecuredDocument())),
    });

    const result = await new UpdateDocument(repository, createEventBus()).execute(
      "book-a",
      buildDocumentInput({ id: "doc-1", path: "intro" }),
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    const saved = (repository.updateMany as Mock).mock.calls[0][1][0].document as Document;
    expect(saved.getMetadata().secured).toBe(true);
  });

  it("ignores a secured value sent by the client", async () => {
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(existingSecuredDocument())),
    });
    const tampered = { ...buildDocumentInput({ id: "doc-1", path: "intro" }), secured: false } as DocumentInput;

    await new UpdateDocument(repository, createEventBus()).execute("book-a", tampered, "owner-1");

    const saved = (repository.updateMany as Mock).mock.calls[0][1][0].document as Document;
    expect(saved.getMetadata().secured).toBe(true);
  });
});
