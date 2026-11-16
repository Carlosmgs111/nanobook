import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { WriteAccessDeniedError } from "../domain/errors";
import { DeleteDocument } from "./DeleteDocument";
import { allowWrites, createDocument, createEventBus, createRepository, denyWrites } from "./test/factories";

const stored = createDocument(
  "intro",
  { title: "Intro", description: "d", createdAt: new Date("2024-01-01"), ownerId: "otro-usuario" },
  "# Intro",
);

function repository() {
  return createRepository({
    getById: vi.fn().mockResolvedValue(Result.ok(stored)),
    list: vi.fn().mockResolvedValue(Result.ok([stored])),
  });
}

describe("DeleteDocument", () => {
  it("rejects actors without write access before reading anything", async () => {
    const repo = repository();

    const result = await new DeleteDocument(repo, createEventBus(), denyWrites).execute("book-a", "doc-1", "intruso");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
    expect(repo.getById).not.toHaveBeenCalled();
    expect(repo.deleteMany).not.toHaveBeenCalled();
  });

  it("lets a nanobook writer delete a document whose stored owner is someone else", async () => {
    const repo = repository();

    const result = await new DeleteDocument(repo, createEventBus(), allowWrites).execute(
      "book-a",
      stored.getDocumentId().getValue(),
      "escritor",
    );

    expect(result.isSuccess).toBe(true);
    expect(repo.deleteMany).toHaveBeenCalledTimes(1);
  });
});
