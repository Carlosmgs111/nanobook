import { describe, expect, it, vi, type Mock } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { EventBusError } from "../../../shared/domain/bus/errors";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  InvalidDocumentIdError,
} from "../domain/errors";
import { AccessCheckFailedError, AccessDeniedError } from "../../../authorization/server";
import { Document } from "../domain/Document";
import { UpdateDocument } from "./UpdateDocument";
import { allowAllAuthorizer, createEventBus, createRepository, denyAllAuthorizer, failingAuthorizer } from "./test/factories";

function stored(path: string, overrides: Record<string, unknown> = {}) {
  return Document.create(
    path,
    {
      id: `id-${path.replaceAll("/", "_")}`,
      title: "Old",
      description: "Old",
      author: "Autora",
      ownerId: "owner-1",
      secured: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      ...overrides,
    },
    "# Old",
    null,
    undefined,
    undefined,
    3,
  ).getValue();
}

const edit = (overrides = {}) => ({
  id: "id-intro",
  path: "intro",
  title: "New",
  description: "New",
  content: "# New",
  ...overrides,
});

const savedUpdates = (repository: ReturnType<typeof createRepository>) =>
  (repository.updateMany as Mock).mock.calls[0][1] as Array<{ document: Document; expectedRevision?: number }>;

describe("UpdateDocument", () => {
  it("saves the edit by a writer who is not the owner, keeping server-owned fields", async () => {
    const repository = createRepository({ getById: vi.fn().mockResolvedValue(Result.ok(stored("intro"))) });
    const bus = createEventBus();
    const forged = { ...edit(), author: "forged", ownerId: "forged", secured: false } as never;

    const result = await new UpdateDocument(repository, bus, allowAllAuthorizer()).execute("book-a", forged, "writer");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getRevision()).toBe(4);
    const [{ document }] = savedUpdates(repository);
    expect(document.getMetadata()).toMatchObject({
      title: "New",
      author: "Autora",
      ownerId: "owner-1",
      secured: true,
      createdAt: new Date("2026-01-01"),
    });
    expect((bus.publish as Mock).mock.calls.map(([event]) => [event.name, event.documentId, event.nanobookId]))
      .toEqual([["document.updated", "id-intro", "book-a"]]);
  });

  it("rejects an actor without write access before reading anything", async () => {
    const repository = createRepository();
    const bus = createEventBus();

    const result = await new UpdateDocument(repository, bus, denyAllAuthorizer()).execute("book-a", edit(), "intruder");

    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.updateMany).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("reports a technical authorizer failure without side effects", async () => {
    const repository = createRepository();
    const bus = createEventBus();

    const result = await new UpdateDocument(repository, bus, failingAuthorizer()).execute("book-a", edit(), "w");

    expect(result.getError()).toBeInstanceOf(AccessCheckFailedError);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("authorizes before validating the document id, with write on the document resource", async () => {
    const authorizer = denyAllAuthorizer();
    const require = vi.spyOn(authorizer, "require");

    const result = await new UpdateDocument(createRepository(), createEventBus(), authorizer).execute(
      "book-a",
      edit({ id: undefined }),
      "intruder",
    );

    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    const [request] = require.mock.calls[0];
    expect(request).toMatchObject({ action: "write", resource: { type: "document", nanobookId: "book-a" } });
    expect(await request.subject.userId()).toBe("intruder");
  });

  it("requires an existing document id", async () => {
    const useCase = new UpdateDocument(createRepository(), createEventBus(), allowAllAuthorizer());

    expect((await useCase.execute("book-a", edit({ id: undefined }), "w")).getError()).toBeInstanceOf(InvalidDocumentIdError);
    expect((await useCase.execute("book-a", edit(), "w")).getError()).toBeInstanceOf(DocumentNotFoundError);
  });

  it("applies the revision the client knew only to the edited document", async () => {
    const repository = createRepository({ getById: vi.fn().mockResolvedValue(Result.ok(stored("intro"))) });

    await new UpdateDocument(repository, createEventBus(), allowAllAuthorizer()).execute("book-a", edit({ expectedRevision: 2 }), "w");

    expect(savedUpdates(repository)[0].expectedRevision).toBe(2);
  });

  it("moves an index together with its descendants and notifies each one", async () => {
    const root = stored("guide/index", { secured: false });
    const child = stored("guide/intro", { secured: false });
    const sibling = stored("other", { secured: false });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(root)),
      list: vi.fn().mockResolvedValue(Result.ok([root, child, sibling])),
    });
    const bus = createEventBus();

    const result = await new UpdateDocument(repository, bus, allowAllAuthorizer()).execute(
      "book-a",
      edit({ id: "id-guide_index", path: "ref/index", expectedRevision: 3 }),
      "w",
    );

    expect(result.isSuccess).toBe(true);
    const updates = savedUpdates(repository);
    expect(updates.map(({ document }) => document.getPath())).toEqual(["ref/index", "ref/intro"]);
    expect(updates.map(({ expectedRevision }) => expectedRevision)).toEqual([3, undefined]);
    expect(bus.publish).toHaveBeenCalledTimes(2);
  });

  it("refuses a move that collides with an unrelated document", async () => {
    const root = stored("guide/index", { secured: false });
    const clash = stored("ref/index", { secured: false });
    const repository = createRepository({
      getById: vi.fn().mockResolvedValue(Result.ok(root)),
      list: vi.fn().mockResolvedValue(Result.ok([root, clash])),
    });

    const result = await new UpdateDocument(repository, createEventBus(), allowAllAuthorizer()).execute(
      "book-a",
      edit({ id: "id-guide_index", path: "ref/index" }),
      "w",
    );

    expect(result.getError()).toBeInstanceOf(DocumentAlreadyExistsError);
    expect(repository.updateMany).not.toHaveBeenCalled();
  });

  it("propagates event bus failures", async () => {
    const repository = createRepository({ getById: vi.fn().mockResolvedValue(Result.ok(stored("intro"))) });
    const bus = createEventBus();
    bus.publish = vi.fn().mockResolvedValue(Result.fail(new EventBusError("boom")));

    const result = await new UpdateDocument(repository, bus, allowAllAuthorizer()).execute("book-a", edit(), "w");

    expect(result.getError()).toBeInstanceOf(EventBusError);
  });
});
