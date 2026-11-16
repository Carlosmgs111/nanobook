import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import { PasswordAccessPolicy } from "../domain/access/DocumentAccessPolicy";
import { DocumentRepositoryError } from "../domain/errors";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { AuthorizeDocumentAccess } from "./access/AuthorizeDocumentAccess";
import { FakeCodec, InMemoryAccessRepository } from "./access/testDoubles";
import { ReadDocument, type DocumentViewer } from "./ReadDocument";
import { allowWrites, denyWrites } from "./test/factories";

const now = new Date("2026-11-04T12:00:00.000Z");

function document(id: string, secured: boolean, content = "# Secreto") {
  return Document.create(
    "guia",
    {
      id,
      title: `Título ${id}`,
      description: "Descripción",
      author: "Autora",
      ownerId: "owner-1",
      secured,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    content,
  ).getValue();
}

async function setup(chain: { raw: Document; resolved: Document } | null, writeAccess: WriteAccess = denyWrites) {
  const accessRepository = new InMemoryAccessRepository();
  await accessRepository.setPasswordHash("doc-1", "hash:clave");
  const authorize = new AuthorizeDocumentAccess(accessRepository, new FakeCodec(), new PasswordAccessPolicy(), () => now);
  const getDocument = { executeChain: vi.fn().mockResolvedValue(chain) };
  return { read: new ReadDocument(getDocument, authorize, writeAccess), getDocument };
}

function viewer(options: { userId?: string; grants?: Record<string, string> } = {}) {
  const userId = vi.fn().mockResolvedValue(options.userId);
  const value: DocumentViewer = { userId, grantFor: (id) => options.grants?.[id] };
  return { value, userId };
}

function spyWriteAccess(allowed: boolean) {
  const require = vi.fn(async (nanobookId: string, actorId: string) =>
    allowed ? Result.ok() : denyWrites.require(nanobookId, actorId),
  );
  return { writeAccess: { require } as unknown as WriteAccess, require };
}

const input = { nanobookId: "book-a", path: "guia" };

describe("ReadDocument", () => {
  it("reports a missing document", async () => {
    const { read } = await setup(null);

    const result = await read.execute({ ...input, viewer: viewer().value });

    expect(result).toEqual({ kind: "not-found" });
  });

  it("allows an unprotected document without resolving the viewer", async () => {
    const open = document("doc-2", false);
    const { writeAccess, require } = spyWriteAccess(true);
    const { read } = await setup({ raw: open, resolved: open }, writeAccess);
    const v = viewer({ userId: "user-1" });

    const result = await read.execute({ ...input, viewer: v.value });

    expect(result).toEqual({ kind: "allowed", document: open, via: "open" });
    expect(v.userId).not.toHaveBeenCalled();
    expect(require).not.toHaveBeenCalled();
  });

  it("allows a writer of the nanobook on a protected document", async () => {
    const secured = document("doc-1", true);
    const { writeAccess, require } = spyWriteAccess(true);
    const { read } = await setup({ raw: secured, resolved: secured }, writeAccess);

    const result = await read.execute({ ...input, viewer: viewer({ userId: "user-1" }).value });

    expect(result).toEqual({ kind: "allowed", document: secured, via: "writer" });
    expect(require).toHaveBeenCalledWith("book-a", "user-1");
  });

  it("allows readers holding a valid grant", async () => {
    const secured = document("doc-1", true);
    const { read } = await setup({ raw: secured, resolved: secured }, denyWrites);

    const result = await read.execute({
      ...input,
      viewer: viewer({ userId: "user-2", grants: { "doc-1": "doc-1:1" } }).value,
    });

    expect(result).toEqual({ kind: "allowed", document: secured, via: "grant" });
  });

  it("challenges anonymous readers without asking the write port, and never returns content", async () => {
    const secured = document("doc-1", true, "# No debe salir");
    const { writeAccess, require } = spyWriteAccess(true);
    const { read } = await setup({ raw: secured, resolved: secured }, writeAccess);

    const result = await read.execute({ ...input, viewer: viewer().value });

    expect(result.kind).toBe("challenge");
    if (result.kind !== "challenge") throw new Error("unreachable");
    expect(result.method).toBe("password");
    expect(result.document.getContent()).toBe("");
    expect(result.document.getDescription()).toBe("");
    expect(result.document.getTitle()).toBe("Título doc-1");
    expect(require).not.toHaveBeenCalled();
  });

  it("fails closed when the write port cannot be consulted", async () => {
    const secured = document("doc-1", true);
    const broken: WriteAccess = { require: async () => Result.fail(new DocumentRepositoryError("db caída")) };
    const { read } = await setup({ raw: secured, resolved: secured }, broken);

    const result = await read.execute({ ...input, viewer: viewer({ userId: "user-1" }).value });

    expect(result.kind).toBe("challenge");
  });

  it("challenges when only the stored link of a proxy chain is protected", async () => {
    const raw = document("doc-1", true);
    const resolved = document("doc-1", false, "# Contenido del destino");
    const { read } = await setup({ raw, resolved });

    const result = await read.execute({ ...input, viewer: viewer({ userId: "user-2" }).value });

    expect(result.kind).toBe("challenge");
    if (result.kind !== "challenge") throw new Error("unreachable");
    expect(result.document.getContent()).toBe("");
  });

  it("forwards the timing observer to the lookup", async () => {
    const open = document("doc-2", false);
    const { read, getDocument } = await setup({ raw: open, resolved: open });
    const observe = vi.fn();

    await read.execute({ ...input, viewer: viewer().value, observeTiming: observe });

    expect(getDocument.executeChain).toHaveBeenCalledWith("book-a", "guia", observe);
  });
});
