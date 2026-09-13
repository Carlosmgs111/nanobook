import { describe, it, expect, vi } from "vitest";
import { CreateDocument } from "./CreateDocument";
import { Document } from "../domain/Document";
import type { ContentRepository, DocumentId } from "../domain/types";
import {
  DocumentAlreadyExistsError,
  InvalidDocumentError,
  InvalidDocumentIdError,
  ParentNotFoundError,
} from "../domain/errors";
import {
  DocumentNotificationError,
  DocumentRepositoryError,
} from "../infraestructure/errors";
import { Result } from "../../shared/utils/result";
import { EventBusError } from "../../shared/bus/errors";
import type { EventBus } from "../../shared/bus/EventBus";
import type { DocumentChangeNotifier } from "../domain/types";

const rootIndex = Document.create(
  "index",
  {
    title: "Root",
    description: "Root index",
    date: new Date(),
    index: true,
  },
  ""
).getValue();

function createRepository(
  overrides: Partial<ContentRepository> = {}
): ContentRepository {
  return {
    list: vi.fn().mockResolvedValue(Result.ok([])),
    get: vi.fn().mockResolvedValue(Result.ok(null)),
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

function buildInput(overrides: { id?: string } = {}) {
  const id = overrides.id ?? "intro";
  return {
    id,
    title: "Introduction",
    description: "Getting started",
    date: new Date("2024-01-01"),
    index: id === "index" || id.endsWith("/index"),
    content: "# Intro\n\nHello.",
  };
}

describe("CreateDocument", () => {
  it("creates a new document and publishes events", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput({ id: "index" }));

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getId().getValue()).toBe("index");
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(notifier.onDocumentCreated).toHaveBeenCalledWith("index");
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it("returns DocumentAlreadyExistsError when the document already exists", async () => {
    const existing = Document.create(
      "intro",
      {
        title: "Existing",
        description: "Existing doc",
        date: new Date(),
        index: false,
      },
      ""
    ).getValue();
    const repository = createRepository({
      get: vi.fn(async (id: DocumentId) => {
        if (id.getValue() === "intro") return Result.ok(existing);
        return Result.ok(null);
      }),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentAlreadyExistsError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(notifier.onDocumentCreated).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("returns InvalidDocumentIdError for malformed ids", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput({ id: "" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("returns InvalidDocumentIdError when an index id is marked as non-index", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      ...buildInput({ id: "index" }),
      index: false,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
  });

  it("returns ParentNotFoundError when the parent does not exist", async () => {
    const repository = createRepository({
      get: vi.fn().mockResolvedValue(Result.ok(null)),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput({ id: "intro" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(ParentNotFoundError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("propagates repository.get errors as Result failures", async () => {
    const repository = createRepository({
      get: vi
        .fn()
        .mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(notifier.onDocumentCreated).not.toHaveBeenCalled();
  });

  it("propagates repository.create errors and does not notify", async () => {
    const repository = createRepository({
      create: vi
        .fn()
        .mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput({ id: "index" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(notifier.onDocumentCreated).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("propagates notifier errors and does not publish events", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier({
      onDocumentCreated: vi
        .fn()
        .mockResolvedValue(
          Result.fail(new DocumentNotificationError("boom"))
        ),
    });
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput({ id: "index" }));

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
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput({ id: "index" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EventBusError);
  });

  it("returns InvalidDocumentError when Document construction fails", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute({
      ...buildInput({ id: "index" }),
      title: undefined as unknown as string,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentError);
  });

  it("notifies both document and parent when creating a child", async () => {
    const repository = createRepository({
      get: vi.fn(async (id: DocumentId) => {
        if (id.getValue() === "index") return Result.ok(rootIndex);
        return Result.ok(null);
      }),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier();
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput({ id: "intro" }));

    expect(result.isSuccess).toBe(true);
    expect(notifier.onDocumentCreated).toHaveBeenCalledWith("intro");
    expect(notifier.onDocumentCreated).toHaveBeenCalledWith("index");
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
  });

  it("stops and propagates when parent notification fails", async () => {
    const repository = createRepository({
      get: vi.fn(async (id: DocumentId) => {
        if (id.getValue() === "index") return Result.ok(rootIndex);
        return Result.ok(null);
      }),
    });
    const eventBus = createEventBus();
    const notifier = createNotifier({
      onDocumentCreated: vi
        .fn()
        .mockResolvedValueOnce(Result.ok())
        .mockResolvedValueOnce(
          Result.fail(new DocumentNotificationError("boom"))
        ),
    });
    const useCase = new CreateDocument(repository, eventBus, notifier);

    const result = await useCase.execute(buildInput({ id: "intro" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentNotificationError);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
