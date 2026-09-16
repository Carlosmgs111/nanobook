import { describe, it, expect, vi } from "vitest";
import { CreateDocument } from "./CreateDocument";
import {
  DocumentAlreadyExistsError,
  InvalidDocumentError,
  InvalidDocumentIdError,
  ParentNotFoundError,
  DocumentRepositoryError,
} from "../domain/errors";
import { Result } from "../../shared/domain/Result";
import { EventBusError } from "../../shared/domain/bus/errors";
import {
  createRepository,
  createEventBus,
  buildDocumentInput,
  createDocument,
} from "./test/factories";

const rootIndex = createDocument("index", {
  title: "Root",
  description: "Root index",
  date: new Date(),
  index: true,
});

describe("CreateDocument", () => {
  it("creates a new document and publishes DocumentCreated", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ id: "index" }));

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getId().getValue()).toBe("index");
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Document:Created",
        payload: { id: "index" },
      })
    );
  });

  it("returns DocumentAlreadyExistsError when the document already exists", async () => {
    const existing = createDocument("intro", {
      title: "Existing",
      description: "Existing doc",
      date: new Date(),
      index: false,
    });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(existing)),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentAlreadyExistsError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("returns InvalidDocumentIdError for malformed ids", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ id: "" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("returns InvalidDocumentIdError when an index id is marked as non-index", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute({
      ...buildDocumentInput({ id: "index" }),
      index: false,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
  });

  it("returns ParentNotFoundError when the parent does not exist", async () => {
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(null)),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ id: "intro" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(ParentNotFoundError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("returns InvalidDocumentIdError when the parent is not an index", async () => {
    const nonIndexParent = createDocument("intro", {
      title: "Intro",
      description: "Not an index",
      date: new Date(),
      index: false,
    });
    const repository = createRepository({
      getById: vi.fn(async (id: string) => {
        if (id === "intro") return Result.ok(nonIndexParent);
        return Result.ok(null);
      }),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(
      buildDocumentInput({ id: "intro/child" })
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("propagates repository.getById errors as Result failures", async () => {
    const repository = createRepository({
      getById: vi
        .fn()
        .mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("propagates repository.create errors and does not publish events", async () => {
    const repository = createRepository({
      create: vi
        .fn()
        .mockResolvedValue(Result.fail(new DocumentRepositoryError("boom"))),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ id: "index" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("propagates eventBus.publish errors", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    eventBus.publish = vi
      .fn()
      .mockResolvedValue(Result.fail(new EventBusError("boom")));
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ id: "index" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EventBusError);
  });

  it("returns InvalidDocumentError when Document construction fails", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute({
      ...buildDocumentInput({ id: "index" }),
      // @ts-expect-error testing runtime validation
      title: undefined,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentError);
  });

  it("publishes DocumentCreated for document and parent when creating a child", async () => {
    const repository = createRepository({
      getById: vi.fn(async (id: string) => {
        if (id === "index") return Result.ok(rootIndex);
        return Result.ok(null);
      }),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ id: "intro" }));

    expect(result.isSuccess).toBe(true);
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Document:Created",
        payload: { id: "intro" },
      })
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Document:Created",
        payload: { id: "index" },
      })
    );
  });

  it("stops and propagates when parent event publication fails", async () => {
    const repository = createRepository({
      getById: vi.fn(async (id: string) => {
        if (id === "index") return Result.ok(rootIndex);
        return Result.ok(null);
      }),
    });
    const eventBus = createEventBus();
    eventBus.publish = vi
      .fn()
      .mockResolvedValueOnce(Result.ok())
      .mockResolvedValueOnce(Result.fail(new EventBusError("boom")));
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ id: "intro" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EventBusError);
  });
});
