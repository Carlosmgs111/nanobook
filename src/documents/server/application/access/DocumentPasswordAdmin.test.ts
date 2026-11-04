import { describe, expect, it, vi, type Mock } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { DocumentAccessDeniedError, DocumentNotFoundError, InvalidDocumentPasswordError } from "../../domain/errors";
import { createEventBus, createRepository } from "../test/factories";
import { ClearDocumentPassword } from "./ClearDocumentPassword";
import { SetDocumentPassword } from "./SetDocumentPassword";
import { FakeHasher, InMemoryAccessRepository } from "./testDoubles";

function document(secured = false) {
  return Document.create(
    "guia",
    {
      id: "doc-1",
      title: "Guía",
      description: "Descripción",
      author: "Autora",
      ownerId: "owner-1",
      secured,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    "# Guía",
    null,
    undefined,
    undefined,
    5,
  ).getValue();
}

function setup(existing: Document | null) {
  const contentRepository = createRepository({
    getByPublicPath: vi.fn().mockResolvedValue(Result.ok(existing)),
  });
  const accessRepository = new InMemoryAccessRepository();
  const eventBus = createEventBus();
  return { contentRepository, accessRepository, eventBus };
}

describe("SetDocumentPassword", () => {
  it("hashes the password, stores it and marks the document as secured", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document());

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus).execute(
      "book-a",
      "guia",
      "una-clave-segura",
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(accessRepository.records.get("doc-1")).toMatchObject({ passwordHash: "hash:una-clave-segura", passwordVersion: 1 });
    const updates = (contentRepository.updateMany as Mock).mock.calls[0][1];
    expect(updates[0].document.getMetadata().secured).toBe(true);
    expect(updates[0].expectedRevision).toBe(5);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it("bumps the version when the password changes", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document(true));
    const useCase = new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus);

    await useCase.execute("book-a", "guia", "primera-clave-1", "owner-1");
    await useCase.execute("book-a", "guia", "segunda-clave-2", "owner-1");

    expect(accessRepository.records.get("doc-1")?.passwordVersion).toBe(2);
  });

  it.each(["corta", "x".repeat(129), "   "])("rejects an invalid password (%s)", async (password) => {
    const { contentRepository, accessRepository, eventBus } = setup(document());

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus).execute(
      "book-a",
      "guia",
      password,
      "owner-1",
    );

    expect(result.getError()).toBeInstanceOf(InvalidDocumentPasswordError);
    expect(accessRepository.records.size).toBe(0);
  });

  it("rejects actors that do not own the document", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document());

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus).execute(
      "book-a",
      "guia",
      "una-clave-segura",
      "intruder",
    );

    expect(result.getError()).toBeInstanceOf(DocumentAccessDeniedError);
    expect(accessRepository.records.size).toBe(0);
  });

  it("fails when the document does not exist", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(null);

    const result = await new SetDocumentPassword(contentRepository, accessRepository, new FakeHasher(), eventBus).execute(
      "book-a",
      "missing",
      "una-clave-segura",
      "owner-1",
    );

    expect(result.getError()).toBeInstanceOf(DocumentNotFoundError);
  });
});

describe("ClearDocumentPassword", () => {
  it("removes the hash, bumps the version and unmarks the document", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document(true));
    await accessRepository.setPasswordHash("doc-1", "hash:vieja-clave-1");

    const result = await new ClearDocumentPassword(contentRepository, accessRepository, eventBus).execute(
      "book-a",
      "guia",
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(accessRepository.records.get("doc-1")).toMatchObject({ passwordHash: null, passwordVersion: 2 });
    const updates = (contentRepository.updateMany as Mock).mock.calls[0][1];
    expect(updates[0].document.getMetadata().secured).toBeUndefined();
  });

  it("is a no-op for documents that are not secured", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document(false));

    const result = await new ClearDocumentPassword(contentRepository, accessRepository, eventBus).execute(
      "book-a",
      "guia",
      "owner-1",
    );

    expect(result.isSuccess).toBe(true);
    expect(accessRepository.records.size).toBe(0);
    expect(contentRepository.updateMany).not.toHaveBeenCalled();
  });

  it("rejects actors that do not own the document", async () => {
    const { contentRepository, accessRepository, eventBus } = setup(document(true));

    const result = await new ClearDocumentPassword(contentRepository, accessRepository, eventBus).execute(
      "book-a",
      "guia",
      "intruder",
    );

    expect(result.getError()).toBeInstanceOf(DocumentAccessDeniedError);
  });
});
