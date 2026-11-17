import { describe, expect, it, vi } from "vitest";

import { AccessCheckFailedError } from "../../../authorization/server";
import { createAuthorizer, Subject, type Resource } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import { NanobookRepositoryError } from "../domain/errors";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { NanobookAccessPolicy } from "./NanobookAccessPolicy";

const book = (id: string, ownerId: string, visibility: "public" | "private") =>
  Nanobook.create({ id, ownerId, slug: id, name: id, visibility }).getValue();

const subjectOf = (userId?: string): Subject => ({
  userId: async () => userId,
  grantFor: () => undefined,
});

function setup() {
  const repository = new InMemoryNanobookRepository([
    book("pub", "owner", "public"),
    book("priv", "owner", "private"),
  ]);
  return createAuthorizer([new NanobookAccessPolicy(repository)]);
}

const nanobook = (id: string): Resource => ({ type: "nanobook", id });
const document = (nanobookId: string): Resource => ({ type: "document", id: "d-1", nanobookId });

describe("NanobookAccessPolicy · lectura", () => {
  it("un nanobook público lo lee cualquiera, también un anónimo", async () => {
    const authorizer = setup();

    expect((await authorizer.authorize({ subject: Subject.anonymous(), action: "read", resource: nanobook("pub") })).effect).toBe("allow");
  });

  it("un nanobook privado solo lo lee su dueño; a los demás les responde not-found", async () => {
    const authorizer = setup();

    expect((await authorizer.authorize({ subject: subjectOf("owner"), action: "read", resource: nanobook("priv") })).effect).toBe("allow");
    expect(await authorizer.authorize({ subject: subjectOf("other"), action: "read", resource: nanobook("priv") })).toEqual({ effect: "deny", reason: "not-found" });
    expect(await authorizer.authorize({ subject: Subject.anonymous(), action: "read", resource: nanobook("priv") })).toEqual({ effect: "deny", reason: "not-found" });
  });

  it("la lectura de un nanobook público no resuelve la sesión", async () => {
    const authorizer = setup();
    const userId = vi.fn(async () => "owner");

    await authorizer.authorize({ subject: { userId, grantFor: () => undefined }, action: "read", resource: nanobook("pub") });

    expect(userId).not.toHaveBeenCalled();
  });
});

describe("NanobookAccessPolicy · escritura", () => {
  it("el dueño escribe, tanto en nanobooks públicos como privados", async () => {
    const authorizer = setup();

    for (const id of ["pub", "priv"]) {
      expect((await authorizer.authorize({ subject: subjectOf("owner"), action: "write", resource: nanobook(id) })).effect).toBe("allow");
    }
  });

  it("un ajeno recibe forbidden en un nanobook público y not-found en uno privado", async () => {
    const authorizer = setup();

    expect(await authorizer.authorize({ subject: subjectOf("other"), action: "write", resource: nanobook("pub") })).toEqual({ effect: "deny", reason: "forbidden" });
    expect(await authorizer.authorize({ subject: subjectOf("other"), action: "write", resource: nanobook("priv") })).toEqual({ effect: "deny", reason: "not-found" });
  });

  it("un anónimo recibe unauthenticated sin consultar el repositorio, exista o no el nanobook", async () => {
    const findById = vi.fn();
    const repository = { findById } as unknown as NanobookRepository;
    const authorizer = createAuthorizer([new NanobookAccessPolicy(repository)]);

    for (const id of ["priv", "no-existe"]) {
      expect(await authorizer.authorize({ subject: Subject.anonymous(), action: "write", resource: nanobook(id) })).toEqual({ effect: "deny", reason: "unauthenticated" });
    }
    expect(findById).not.toHaveBeenCalled();
  });
});

describe("NanobookAccessPolicy · documentos y errores", () => {
  it("evalúa un recurso de tipo document por su nanobookId", async () => {
    const authorizer = setup();

    expect((await authorizer.authorize({ subject: subjectOf("owner"), action: "write", resource: document("priv") })).effect).toBe("allow");
    expect(await authorizer.authorize({ subject: subjectOf("other"), action: "write", resource: document("priv") })).toEqual({ effect: "deny", reason: "not-found" });
  });

  it("un document sin nanobookId se deniega", async () => {
    const authorizer = setup();
    const resource: Resource = { type: "document", id: "d-1" };

    expect(await authorizer.authorize({ subject: subjectOf("owner"), action: "read", resource })).toEqual({ effect: "deny", reason: "forbidden" });
  });

  it("un nanobook inexistente responde not-found", async () => {
    const authorizer = setup();

    expect(await authorizer.authorize({ subject: subjectOf("owner"), action: "read", resource: nanobook("no-existe") })).toEqual({ effect: "deny", reason: "not-found" });
  });

  it("un fallo del repositorio es un error técnico, nunca un deny ni un allow", async () => {
    const repository = {
      findById: async () => Result.fail(new NanobookRepositoryError("db caída")),
    } as unknown as NanobookRepository;
    const authorizer = createAuthorizer([new NanobookAccessPolicy(repository)]);

    await expect(
      authorizer.authorize({ subject: subjectOf("owner"), action: "read", resource: nanobook("pub") }),
    ).rejects.toBeInstanceOf(AccessCheckFailedError);
  });
});
