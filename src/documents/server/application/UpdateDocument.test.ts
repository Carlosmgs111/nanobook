import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { EventBusError } from "../../../shared/domain/bus/errors";
import { WriteAccessDeniedError } from "../domain/errors";
import { UpdateDocument } from "./UpdateDocument";
import {
  allowWrites,
  createDocument,
  createEventBus,
  createRepository,
  denyWrites,
} from "./test/factories";

describe("UpdateDocument", () => {
  it("propagates eventBus.publish errors", async () => {
    const existingDocument = createDocument(
      "guide/intro",
      {
        title: "Old title",
        description: "Old description",
        createdAt: new Date("2024-01-01"),
      },
      "# Old",
    );
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(existingDocument)),
    });
    const eventBus = createEventBus();
    eventBus.publish = vi
      .fn()
      .mockResolvedValue(Result.fail(new EventBusError("boom")));
    const useCase = new UpdateDocument(repository, eventBus, allowWrites);

    const result = await useCase.execute(
      "book-a",
      {
        id: existingDocument.getDocumentId().getValue(),
        path: "guide/intro",
        title: "New title",
        description: "New description",
        createdAt: new Date("2024-01-02"),
        content: "# New",
      },
      "owner-1",
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EventBusError);
  });

  it("rejects actors without write access before reading anything", async () => {
    const repository = createRepository();
    const useCase = new UpdateDocument(repository, createEventBus(), denyWrites);

    const result = await useCase.execute(
      "book-a",
      { id: "doc-1", path: "intro", title: "T", description: "D", createdAt: new Date("2024-01-02"), content: "# T" },
      "intruso",
    );

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.updateMany).not.toHaveBeenCalled();
  });

  it("lets a nanobook writer edit a document whose stored owner is someone else", async () => {
    const existing = createDocument(
      "intro",
      { title: "Old", description: "Old", createdAt: new Date("2024-01-01"), ownerId: "otro-usuario" },
      "# Old",
    );
    const repository = createRepository({ getById: vi.fn().mockResolvedValue(Result.ok(existing)) });

    const result = await new UpdateDocument(repository, createEventBus(), allowWrites).execute(
      "book-a",
      { id: existing.getDocumentId().getValue(), path: "intro", title: "New", description: "New", createdAt: new Date("2024-01-02"), content: "# New" },
      "escritor",
    );

    expect(result.isSuccess).toBe(true);
  });
});
