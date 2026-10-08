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
  createdAt: new Date(),
});

describe("CreateDocument", () => {
  it("creates a new document and publishes DocumentCreated", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ path: "index" }));

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getDocumentId().getValue()).toMatch(
      /^[0-9a-f-]{36}$/
    );
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "document.created",
        documentId: result.getValue().getDocumentId().getValue(),
      })
    );
  });

  it("persists the owner assigned by the authenticated flow", async () => {
    const useCase = new CreateDocument(createRepository(), createEventBus());

    const result = await useCase.execute(
      buildDocumentInput({
        path: "index",
        ownerId: "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
      }),
    );

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getMetadata().ownerId).toBe(
      "toK9gRckXueNJVDO03YsBJA8Qwjjp3Zv",
    );
  });

  it("returns DocumentAlreadyExistsError when the document already exists", async () => {
    const existing = createDocument("intro", {
      title: "Existing",
      description: "Existing doc",
      createdAt: new Date(),
    });
    const repository = createRepository({
      getByPath: vi.fn().mockResolvedValue(Result.ok(existing)),
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

    const result = await useCase.execute(buildDocumentInput({ path: "" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentIdError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("derives the index type from the path instead of the legacy flag", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute({
      ...buildDocumentInput({ path: "index" }),
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().isIndex()).toBe(true);
  });

  it("returns ParentNotFoundError when the parent does not exist", async () => {
    const repository = createRepository({
      getByPath: vi.fn().mockResolvedValue(Result.ok(null)),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ path: "intro" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(ParentNotFoundError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("looks for child documents under the parent's internal index", async () => {
    const nonIndexParent = createDocument("intro", {
      title: "Intro",
      description: "Not an index",
      createdAt: new Date(),
    });
    const repository = createRepository({
      getByPath: vi.fn(async (id: string) => {
        if (id === "intro") return Result.ok(nonIndexParent);
        return Result.ok(null);
      }),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(
      buildDocumentInput({ path: "intro/child" })
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(ParentNotFoundError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("propagates repository.getById errors as Result failures", async () => {
    const repository = createRepository({
      getByPath: vi
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

    const result = await useCase.execute(buildDocumentInput({ path: "index" }));

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

    const result = await useCase.execute(buildDocumentInput({ path: "index" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EventBusError);
  });

  it("returns InvalidDocumentError when Document construction fails", async () => {
    const repository = createRepository();
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute({
      ...buildDocumentInput({ path: "index" }),
      // @ts-expect-error testing runtime validation
      title: undefined,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidDocumentError);
  });

  it("publishes DocumentCreated for document and parent when creating a child", async () => {
    const repository = createRepository({
      getByPath: vi.fn(async (id: string) => {
        if (id === "index") return Result.ok(rootIndex);
        return Result.ok(null);
      }),
    });
    const eventBus = createEventBus();
    const useCase = new CreateDocument(repository, eventBus);

    const result = await useCase.execute(buildDocumentInput({ path: "intro" }));

    expect(result.isSuccess).toBe(true);
    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "document.created",
        documentId: result.getValue().getDocumentId().getValue(),
      })
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "document.created",
        documentId: rootIndex.getDocumentId().getValue(),
      })
    );
  });

  it("resolves a directory parent through its internal index path", async () => {
    const parent = createDocument("new-dir/index", {
      title: "new-dir",
      description: "Directory",
      createdAt: new Date(),
    });
    const repository = createRepository({
      getByPath: vi.fn(async (path: string) => {
        if (path === "new-dir/index") return Result.ok(parent);
        return Result.ok(null);
      }),
    });
    const useCase = new CreateDocument(repository, createEventBus());

    const result = await useCase.execute(buildDocumentInput({ path: "new-dir/file" }));

    expect(result.isSuccess).toBe(true);
    expect(repository.getByPath).toHaveBeenCalledWith("new-dir/index");
  });

  it("stops and propagates when parent event publication fails", async () => {
    const repository = createRepository({
      getByPath: vi.fn(async (id: string) => {
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

    const result = await useCase.execute(buildDocumentInput({ path: "intro" }));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(EventBusError);
  });
});
