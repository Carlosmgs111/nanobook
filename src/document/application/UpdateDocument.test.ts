import { describe, it, expect, vi } from "vitest";
import { UpdateDocument } from "./UpdateDocument";
import {
  DocumentNotFoundError,
  InvalidDocumentError,
  InvalidDocumentIdError,
  DocumentRepositoryError,
} from "../domain/errors";
import { Result } from "../../shared/domain/Result";
import { EventBusError } from "../../shared/domain/bus/errors";
import {
  createRepository,
  createEventBus,
  createDocument,
} from "./test/factories";
import type { DocumentInput } from "./dto/DocumentInput";

const existingDocument = createDocument(
  "guide/intro",
  {
    title: "Old title",
    description: "Old description",
    date: new Date("2024-01-01"),
    index: false,
  },
  "# Old"
);

function buildUpdateInput(
  overrides: Partial<DocumentInput> & { id?: string } = {}
): DocumentInput {
  return {
    id: overrides.id ?? "guide/intro",
    title: overrides.title ?? "New title",
    description: overrides.description ?? "New description",
    date: overrides.date ?? new Date("2024-01-02"),
    index: overrides.index ?? false,
    content: overrides.content ?? "# New",
    ...overrides,
  };
}

describe("UpdateDocument", () => {
  it("updates an existing document and publishes DocumentUpdated", async () => {
    const repository = createRepository({
      getByPath: vi.fn().mockResolvedValue(Result.ok(existingDocument)),
    });
    const eventBus = createEventBus();
    const useCase = new UpdateDocument(repository, eventBus);

    const result = await useCase.execute(buildUpdateInput());

    expect(result.isSuccess).toBe(true);
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "document.updated",
        documentId: existingDocument.getDocumentId().getValue(),
      })
    );
  });

  it("returns DocumentNotFoundError when the document does not exist", async () => {
    const repository = createRepository({
      getByPath: vi.fn().mockResolvedValue(Result.ok(null)),
    });
    const eventBus = createEventBus();
    const useCase = new UpdateDocument(repository, eventBus);

    const result = await useCase.execute(buildUpdateInput({ id: "missing" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentNotFoundError);
    expect(repository.update).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("returns InvalidDocumentIdError for malformed ids", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new UpdateDocument(repository, eventBus);

    const result = await useCase.execute(buildUpdateInput({ id: "" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("propagates repository.getById errors as Result failures", async () => {
    const repository = createRepository({
      getByPath: vi
        .fn()
        .mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();
    const useCase = new UpdateDocument(repository, eventBus);

    const result = await useCase.execute(buildUpdateInput());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("propagates repository.update errors and does not publish events", async () => {
    const repository = createRepository({
      getByPath: vi.fn().mockResolvedValue(Result.ok(existingDocument)),
      update: vi
        .fn()
        .mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();
    const useCase = new UpdateDocument(repository, eventBus);

    const result = await useCase.execute(buildUpdateInput());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("propagates eventBus.publish errors", async () => {
    const repository = createRepository({
      getByPath: vi.fn().mockResolvedValue(Result.ok(existingDocument)),
    });
    const eventBus = createEventBus();
    eventBus.publish = vi
      .fn()
      .mockResolvedValue(Result.fail(new EventBusError("boom")));
    const useCase = new UpdateDocument(repository, eventBus);

    const result = await useCase.execute(buildUpdateInput());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EventBusError);
  });

  it("returns InvalidDocumentError when Document construction fails", async () => {
    const repository = createRepository({
      getByPath: vi.fn().mockResolvedValue(Result.ok(existingDocument)),
    });
    const eventBus = createEventBus();
    const useCase = new UpdateDocument(repository, eventBus);

    const result = await useCase.execute({
      ...buildUpdateInput(),
      // @ts-expect-error testing runtime validation
      title: undefined,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentError);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
