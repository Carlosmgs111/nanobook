import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import type { EventBus } from "../../../../shared/domain/bus/EventBus";
import { Document } from "../../domain/Document";
import type { DocumentAccessRecord, DocumentAccessRepository } from "../../domain/access/ports";
import { AccessCheckFailedError, AccessDeniedError, createAuthorizer, type Authorizer } from "../../../../authorization/server";
import { InvalidDocumentPasswordError } from "../../domain/errors";
import type { ContentRepository } from "../../domain/ports/ContentRepository";
import { ClearDocumentPassword } from "./ClearDocumentPassword";
import { SetDocumentPassword } from "./SetDocumentPassword";

const at = new Date("2026-01-01T00:00:00.000Z");

function document(secured: boolean) {
  return Document.create(
    "guia",
    { id: "doc-1", title: "Guía", description: "d", author: "a", ownerId: "owner-1", secured, createdAt: at, updatedAt: at },
    "# Guía",
    null,
    undefined,
    undefined,
    5,
  ).getValue();
}

const authorizer: Authorizer = createAuthorizer([
  {
    appliesTo: ["document"],
    evaluate: async ({ subject }) =>
      (await subject.userId()) === "owner-1" ? { effect: "allow" } : { effect: "deny", reason: "forbidden" },
  },
]);

function setup(secured: boolean, existingHash: string | null = null, access: Authorizer = authorizer) {
  const records = new Map<string, DocumentAccessRecord>();
  if (existingHash) records.set("doc-1", { documentId: "doc-1", passwordHash: existingHash, passwordVersion: 1 });
  const accessRepository: DocumentAccessRepository = {
    get: async (id) => Result.ok(records.get(id) ?? null),
    setPasswordHash: async (documentId, passwordHash) => {
      const record = { documentId, passwordHash, passwordVersion: (records.get(documentId)?.passwordVersion ?? 0) + 1 };
      records.set(documentId, record);
      return Result.ok(record);
    },
  };
  const contentRepository = {
    getByPublicPath: vi.fn().mockResolvedValue(Result.ok(document(secured))),
    updateMany: vi.fn().mockResolvedValue(Result.ok()),
  } as unknown as ContentRepository;
  const eventBus = { publish: vi.fn().mockResolvedValue(Result.ok()), subscribe: vi.fn() } as EventBus;
  const hasher = { hash: async (password: string) => `hash:${password}`, verify: async () => true };
  return {
    records,
    contentRepository,
    eventBus,
    set: new SetDocumentPassword(contentRepository, accessRepository, hasher, eventBus, access),
    clear: new ClearDocumentPassword(contentRepository, accessRepository, eventBus, access),
  };
}

describe("SetDocumentPassword", () => {
  it("el autor guarda el hash, protege el documento y publica el evento", async () => {
    const { set, records, contentRepository, eventBus } = setup(false);

    const result = await set.execute("book-a", "guia", "una-clave-segura", "owner-1");

    expect(result.isSuccess).toBe(true);
    expect(records.get("doc-1")).toMatchObject({ passwordHash: "hash:una-clave-segura", passwordVersion: 1 });
    const [update] = vi.mocked(contentRepository.updateMany).mock.calls[0][1];
    expect(update.document.getMetadata().secured).toBe(true);
    expect(update.expectedRevision).toBe(5);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it("un ajeno no guarda nada", async () => {
    const { set, records, contentRepository } = setup(false);

    const result = await set.execute("book-a", "guia", "una-clave-segura", "intruso");

    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect(records.size).toBe(0);
    expect(contentRepository.updateMany).not.toHaveBeenCalled();
  });

  it("un ajeno con contraseña inválida recibe acceso denegado, no un error de validación", async () => {
    const { set, records } = setup(false);

    const result = await set.execute("book-a", "guia", "corta", "intruso");

    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect(records.size).toBe(0);
  });

  it("un fallo técnico del autorizador no guarda nada", async () => {
    const failing: Authorizer = {
      authorize: async () => {
        throw new AccessCheckFailedError(new Error("db caída"));
      },
      require: async () => Result.fail(new AccessCheckFailedError(new Error("db caída"))),
    };
    const { set, clear, records, contentRepository } = setup(true, "hash:vieja", failing);

    expect((await set.execute("book-a", "guia", "una-clave-segura", "owner-1")).getError()).toBeInstanceOf(AccessCheckFailedError);
    expect((await clear.execute("book-a", "guia", "owner-1")).getError()).toBeInstanceOf(AccessCheckFailedError);
    expect(records.get("doc-1")).toMatchObject({ passwordHash: "hash:vieja", passwordVersion: 1 });
    expect(contentRepository.updateMany).not.toHaveBeenCalled();
  });

  it("autoriza write sobre el documento del nanobook con el actor como sujeto", async () => {
    const spied: Authorizer = { ...authorizer, require: vi.fn(authorizer.require) };
    const { set } = setup(false, null, spied);

    await set.execute("book-a", "guia", "una-clave-segura", "owner-1");

    const [request] = vi.mocked(spied.require).mock.calls[0];
    expect(request).toMatchObject({ action: "write", resource: { type: "document", id: "guia", nanobookId: "book-a" } });
    expect(await request.subject.userId()).toBe("owner-1");
  });

  it.each(["corta", "x".repeat(129), "        "])("rechaza una contraseña inválida (%j)", async (password) => {
    const { set, records } = setup(false);

    const result = await set.execute("book-a", "guia", password, "owner-1");

    expect(result.getError()).toBeInstanceOf(InvalidDocumentPasswordError);
    expect(records.size).toBe(0);
  });

  it("cambiar la contraseña incrementa la versión", async () => {
    const { set, records } = setup(true, "hash:vieja");

    await set.execute("book-a", "guia", "otra-clave-nueva", "owner-1");

    expect(records.get("doc-1")?.passwordVersion).toBe(2);
  });
});

describe("ClearDocumentPassword", () => {
  it("el autor retira el hash, sube la versión y desprotege el documento", async () => {
    const { clear, records, contentRepository } = setup(true, "hash:vieja");

    const result = await clear.execute("book-a", "guia", "owner-1");

    expect(result.isSuccess).toBe(true);
    expect(records.get("doc-1")).toMatchObject({ passwordHash: null, passwordVersion: 2 });
    const [update] = vi.mocked(contentRepository.updateMany).mock.calls[0][1];
    expect(update.document.getMetadata().secured).toBeUndefined();
  });

  it("un ajeno no retira la protección", async () => {
    const { clear, records, contentRepository } = setup(true, "hash:vieja");

    const result = await clear.execute("book-a", "guia", "intruso");

    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect(records.get("doc-1")).toMatchObject({ passwordHash: "hash:vieja", passwordVersion: 1 });
    expect(contentRepository.updateMany).not.toHaveBeenCalled();
  });
});
