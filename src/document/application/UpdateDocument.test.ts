import { describe, it, expect, vi } from "vitest";
import { UpdateDocument } from "./UpdateDocument";
import { Document } from "../domain/Document";
import type { ContentRepository, DocumentId } from "../domain/types";
import {
  DocumentNotFoundError,
  InvalidDocumentError,
  InvalidDocumentIdError,
} from "../domain/errors";
import {
  DocumentNotificationError,
  DocumentRepositoryError,
} from "../infraestructure/errors";
import { Result } from "../../shared/utils/result";
import { EventBusError } from "../../shared/bus/errors";
import type { EventBus } from "../../shared/bus/EventBus";
import type { DocumentChangeNotifier } from "../domain/types";

const existingDocument = Document.create(
  "guide/intro",
  {
    title: "Old title",
    description: "Old description",
    date: new Date("2024-01-01"),
    index: false,
  },
  "# Old"
).getValue();

function createRepository(
  overrides: Partial<ContentRepository> = {}
): ContentRepository {
  return {
    list: vi.fn().mockResolvedValue(Result.ok([])),
    get: vi.fn(async (id: DocumentId) => {
      if (id.getValue() === "guide/intro") return Result.ok(existingDocument);
      return Result.ok(null);
    }),
    getBySlug: vi.fn().mockResolvedValue(Result.ok(null)),
    listChildren: vi.fn().mockResolvedValue(Result.ok([])),
    create: vi.fn().mockResolvedValue(Result.ok()),
    update: vi.fn().mockResolvedValue(Result.ok()),
    ...overrides,
  };
}

function createEventBus(): EventBus {
  return {
    publish: vi.fn().mockResolvedValue(Result.ok()),
    subscribe: vi.fn(),
  };
}

function createNotifier(
  overrides: Partial<DocumentChangeNotifier> = {}
): DocumentChangeNotifier {
  return {
    onDocumentCreated: vi.fn().mockResolvedValue(Result.ok()),
    onDocumentUpdated: vi.fn().mockResolvedValue(Result.ok()),
    ...overrides,
  };
}

describe("UpdateDocument", () => {
  it("updates an existing document", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new UpdateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      id: "guide/intro",
      title: "New title",
      description: "New description",
      date: new Date("2024-01-02"),
      index: false,
      content: "# New",
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(notifier.onDocumentUpdated).toHaveBeenCalledWith("guide/intro");
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it("returns DocumentNotFoundError when the document does not exist", async () => {
    const repository = createRepository({
      get: vi.fn().mockResolvedValue(Result.ok(null)),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new UpdateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      id: "missing",
      title: "Missing",
      description: "Missing",
      date: new Date(),
      index: false,
      content: "",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentNotFoundError);
    expect(repository.update).not.toHaveBeenCalled();
    expect(notifier.onDocumentUpdated).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("returns InvalidDocumentIdError for malformed ids", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new UpdateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      id: "",
      title: "Bad",
      description: "Bad",
      date: new Date(),
      index: false,
      content: "",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("propagates repository.get errors as Result failures", async () => {
    const repository = createRepository({
      get: vi
        .fn()
        .mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new UpdateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      id: "guide/intro",
      title: "New",
      description: "New",
      date: new Date(),
      index: false,
      content: "",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("propagates repository.update errors and does not notify", async () => {
    const repository = createRepository({
      update: vi
        .fn()
        .mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new UpdateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      id: "guide/intro",
      title: "New",
      description: "New",
      date: new Date(),
      index: false,
      content: "",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(notifier.onDocumentUpdated).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("propagates notifier errors and does not publish events", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier({
      onDocumentUpdated: vi
        .fn()
        .mockResolvedValue(
          Result.fail(new DocumentNotificationError("boom"))
        ),
    });
    const useCase = new UpdateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      id: "guide/intro",
      title: "New",
      description: "New",
      date: new Date(),
      index: false,
      content: "",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentNotificationError);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("propagates eventBus.publish errors", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    eventBus.publish = vi
      .fn()
      .mockResolvedValue(Result.fail(new EventBusError("boom")));
    const notifier = createNotifier();
    const useCase = new UpdateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      id: "guide/intro",
      title: "New",
      description: "New",
      date: new Date(),
      index: false,
      content: "",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EventBusError);
  });

  it("returns InvalidDocumentError when Document construction fails", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new UpdateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      id: "guide/intro",
      title: undefined as unknown as string,
      description: "New",
      date: new Date(),
      index: false,
      content: "",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentError);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
