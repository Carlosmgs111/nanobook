import { describe, expect, it, vi, type Mock } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { EventBusError } from "../../../shared/domain/bus/errors";
import { DocumentNotFoundError } from "../domain/errors";
import { AccessCheckFailedError, AccessDeniedError, type Authorizer } from "../../../authorization/server";
import { Document } from "../domain/Document";
import { DeleteDocument } from "./DeleteDocument";
import { allowAllAuthorizer, createEventBus, createRepository, denyAllAuthorizer, failingAuthorizer } from "./test/factories";

const stored = (path: string) =>
  Document.create(path, {
    id: `id-${path.replaceAll("/", "_")}`,
    title: "T",
    description: "D",
    ownerId: "someone-else",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  }).getValue();

function setup(documents: Document[], target: Document, authorizer: Authorizer = allowAllAuthorizer()) {
  const repository = createRepository({
    getById: vi.fn().mockResolvedValue(Result.ok(target)),
    list: vi.fn().mockResolvedValue(Result.ok(documents)),
  });
  const bus = createEventBus();
  const run = () => new DeleteDocument(repository, bus, authorizer).execute("book-a", target.getDocumentId().getValue(), "writer");
  return { repository, bus, run };
}

const deletedPaths = (repository: ReturnType<typeof createRepository>) =>
  (repository.deleteMany as Mock).mock.calls[0][1].map((document: Document) => document.getPath());

describe("DeleteDocument", () => {
  it("deletes only the document when it is not an index, even for a writer who is not the owner", async () => {
    const target = stored("guide/intro");
    const { repository, bus, run } = setup([target, stored("guide/intro/extra"), stored("other")], target);

    expect((await run()).isSuccess).toBe(true);

    expect(deletedPaths(repository)).toEqual(["guide/intro"]);
    expect((bus.publish as Mock).mock.calls.map(([event]) => [event.name, event.documentId, event.nanobookId]))
      .toEqual([["document.deleted", "id-guide_intro", "book-a"]]);
  });

  it("deletes the whole subtree of an index and notifies each document", async () => {
    const target = stored("guide/index");
    const documents = [target, stored("guide/intro"), stored("guide/deep/page"), stored("guide-other/page")];
    const { repository, bus, run } = setup(documents, target);

    await run();

    expect(deletedPaths(repository)).toEqual(["guide/index", "guide/intro", "guide/deep/page"]);
    expect(bus.publish).toHaveBeenCalledTimes(3);
  });

  it("rejects an actor without write access before reading anything", async () => {
    const target = stored("intro");
    const { repository, bus, run } = setup([target], target, denyAllAuthorizer());

    expect((await run()).getError()).toBeInstanceOf(AccessDeniedError);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.deleteMany).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("reports a technical authorizer failure without side effects", async () => {
    const target = stored("intro");
    const { repository, bus, run } = setup([target], target, failingAuthorizer());

    expect((await run()).getError()).toBeInstanceOf(AccessCheckFailedError);
    expect(repository.getById).not.toHaveBeenCalled();
    expect(repository.deleteMany).not.toHaveBeenCalled();
    expect(bus.publish).not.toHaveBeenCalled();
  });

  it("requires write on the document resource of the nanobook for the actor", async () => {
    const target = stored("intro");
    const authorizer = allowAllAuthorizer();
    const require = vi.spyOn(authorizer, "require");

    await setup([target], target, authorizer).run();

    const [request] = require.mock.calls[0];
    expect(request).toMatchObject({ action: "write", resource: { type: "document", id: "id-intro", nanobookId: "book-a" } });
    expect(await request.subject.userId()).toBe("writer");
  });

  it("fails when the document does not exist", async () => {
    const result = await new DeleteDocument(createRepository(), createEventBus(), allowAllAuthorizer()).execute("book-a", "missing", "writer");

    expect(result.getError()).toBeInstanceOf(DocumentNotFoundError);
  });

  it("propagates event bus failures", async () => {
    const target = stored("intro");
    const { bus, run } = setup([target], target);
    bus.publish = vi.fn().mockResolvedValue(Result.fail(new EventBusError("boom")));

    expect((await run()).getError()).toBeInstanceOf(EventBusError);
  });
});
