import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { EventBusError } from "../../../shared/domain/bus/errors";
import { UpdateDocument } from "./UpdateDocument";
import {
  createDocument,
  createEventBus,
  createRepository,
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
    const useCase = new UpdateDocument(repository, eventBus);

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
});
