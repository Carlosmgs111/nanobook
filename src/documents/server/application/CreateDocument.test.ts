import { describe, expect, it, vi, type Mock } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { EventBusError } from "../../../shared/domain/bus/errors";
import {
  DocumentAlreadyExistsError,
  InvalidDocumentIdError,
  ParentNotFoundError,
} from "../domain/errors";
import { AccessCheckFailedError, AccessDeniedError } from "../../../authorization/server";
import { CreateDocument } from "./CreateDocument";
import { allowAllAuthorizer, buildDocumentInput, createDocument, createEventBus, createRepository, denyAllAuthorizer, failingAuthorizer } from "./test/factories";

const published = (bus: ReturnType<typeof createEventBus>) =>
  (bus.publish as Mock).mock.calls.map(([event]) => [event.name, event.documentId, event.nanobookId]);

describe("CreateDocument", () => {
  it("persists the document owned by the actor and publishes DocumentCreated", async () => {
    const repository = createRepository();
    const bus = createEventBus();

    const result = await new CreateDocument(repository, bus, allowAllAuthorizer()).execute(
      "book-a",
      buildDocumentInput({ id: "doc-1", path: "index" }),
      "author-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getMetadata().ownerId).toBe("author-1");
    expect(repository.create).toHaveBeenCalledWith("book-a", result.getValue());
    expect(published(bus)).toEqual([["document.created", "doc-1", "book-a"]]);
  });

  it("also notifies the parent index when the document hangs from one", async () => {
    const parent = createDocument("index", { title: "Root", description: "d", id: "root" });
    const repository = createRepository({
      getByPath: vi.fn(async (_nanobookId: string, path: string) => Result.ok(path === "index" ? parent : null)),
    });
    const bus = createEventBus();

    await new CreateDocument(repository, bus, allowAllAuthorizer()).execute(
      "book-a",
      buildDocumentInput({ id: "child", path: "intro" }),
      "author-1",
    );

    expect(published(bus)).toEqual([
      ["document.created", "child", "book-a"],
      ["document.created", "root", "book-a"],
    ]);
  });

  it("rejects an actor without write access before touching anything", async () => {
    const repository = createRepository();
    const bus = createEventBus();

    const result = await new CreateDocument(repository, bus, denyAllAuthorizer()).execute(
      "book-a",
      buildDocumentInput({ path: "index" }),
      "intruder",
    );

    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect(repository.getByPath).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("reports a technical authorizer failure without side effects", async () => {
    const repository = createRepository();
    const bus = createEventBus();

    const result = await new CreateDocument(repository, bus, failingAuthorizer()).execute(
      "book-a",
      buildDocumentInput({ path: "index" }),
      "writer",
    );

    expect(result.getError()).toBeInstanceOf(AccessCheckFailedError);
    expect(repository.create).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("requires write on the document resource of the nanobook for the actor", async () => {
    const authorizer = allowAllAuthorizer();
    const require = vi.spyOn(authorizer, "require");

    await new CreateDocument(createRepository(), createEventBus(), authorizer).execute(
      "book-a",
      buildDocumentInput({ path: "guide/intro" }),
      "author-1",
    );

    const [request] = require.mock.calls[0];
    expect(request).toMatchObject({ action: "write", resource: { type: "document", id: "guide/intro", nanobookId: "book-a" } });
    expect(await request.subject.userId()).toBe("author-1");
  });

  it("rejects an invalid path, a duplicate and a missing parent without persisting", async () => {
    const repository = createRepository();
    const useCase = new CreateDocument(repository, createEventBus(), allowAllAuthorizer());

    expect((await useCase.execute("book-a", buildDocumentInput({ path: "" }), "a")).getError())
      .toBeInstanceOf(InvalidDocumentIdError);
    expect((await useCase.execute("book-a", buildDocumentInput({ path: "guide/intro" }), "a")).getError())
      .toBeInstanceOf(ParentNotFoundError);

    const taken = createDocument("intro", { title: "t", description: "d" });
    (repository.getByPath as Mock).mockResolvedValue(Result.ok(taken));
    expect((await useCase.execute("book-a", buildDocumentInput({ path: "intro" }), "a")).getError())
      .toBeInstanceOf(DocumentAlreadyExistsError);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("ignores audit dates sent by the client", async () => {
    const forged = { ...buildDocumentInput({ path: "index" }), createdAt: new Date("2000-01-01") } as never;

    const result = await new CreateDocument(createRepository(), createEventBus(), allowAllAuthorizer()).execute("book-a", forged, "a");

    expect(result.getValue().getMetadata().createdAt.getFullYear()).toBeGreaterThan(2020);
  });

  it("propagates event bus failures", async () => {
    const bus = createEventBus();
    bus.publish = vi.fn().mockResolvedValue(Result.fail(new EventBusError("boom")));

    const result = await new CreateDocument(createRepository(), bus, allowAllAuthorizer()).execute(
      "book-a",
      buildDocumentInput({ path: "index" }),
      "a",
    );

    expect(result.getError()).toBeInstanceOf(EventBusError);
  });
});
