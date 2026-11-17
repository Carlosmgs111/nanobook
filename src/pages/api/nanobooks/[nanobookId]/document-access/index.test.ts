import type { APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createAuthorizer } from "../../../../../authorization/server";
import { ClearDocumentPassword } from "../../../../../documents/server/application/access/ClearDocumentPassword";
import { SetDocumentPassword } from "../../../../../documents/server/application/access/SetDocumentPassword";
import { DocumentAccessAdminController } from "../../../../../documents/server/infraestructure/rest/DocumentAccessAdminController";
import { NanobookAccessPolicy } from "../../../../../nanobooks/server/application/NanobookAccessPolicy";
import { Nanobook } from "../../../../../nanobooks/server/domain/Nanobook";
import { InMemoryNanobookRepository } from "../../../../../nanobooks/server/infraestructure/repository/InMemoryNanobookRepository";
import { Result } from "../../../../../shared/domain/Result";

function book(id: string, visibility: "public" | "private") {
  return Nanobook.create({ id, ownerId: "owner-1", slug: id, name: id, visibility }).getValue();
}

const authorizer = createAuthorizer([
  new NanobookAccessPolicy(
    new InMemoryNanobookRepository([book("book-priv", "private"), book("book-pub", "public")]),
  ),
]);

const repository = { getByPath: vi.fn().mockResolvedValue(Result.ok(null)) };
const eventBus = { publish: vi.fn().mockResolvedValue(Result.ok()), subscribe: vi.fn() };

// La aplicación compuesta no expone ningún autorizador a las rutas: la decisión vive en los casos de uso.
const protect = vi.fn((handler: APIRoute) => handler);
vi.mock("../../../../../application/server/Application", () => ({
  getApp: async () => ({
    routeProtector: { protect },
    nanobookModule: {
      documentModule: {
        documentAccessAdminController: new DocumentAccessAdminController(
          new SetDocumentPassword(repository as never, {} as never, {} as never, eventBus, authorizer),
          new ClearDocumentPassword(repository as never, {} as never, eventBus, authorizer),
        ),
      },
    },
  }),
}));

function context(userId: string | undefined, nanobookId: string, method: string) {
  return {
    request: new Request(`https://nanobook.test/api/nanobooks/${nanobookId}/document-access`, {
      method,
      body: JSON.stringify({ path: "intro", password: "contraseña-larga" }),
    }),
    params: { nanobookId },
    locals: { currentUserId: userId },
  } as unknown as Parameters<APIRoute>[0];
}

describe("rutas de contraseña de documentos sin guard", () => {
  it("protege cada método solo con el RouteProtector", async () => {
    await import("./index");

    expect(protect).toHaveBeenCalledTimes(2);
  });

  it.each(["PUT", "DELETE"] as const)("%s sin sesión responde 401", async (method) => {
    const route = (await import("./index"))[method];

    expect((await route(context(undefined, "book-priv", method))).status).toBe(401);
  });

  it.each(["PUT", "DELETE"] as const)(
    "%s de un ajeno sobre un nanobook privado y sobre uno inexistente responde el mismo 404",
    async (method) => {
      const route = (await import("./index"))[method];

      const priv = await route(context("stranger", "book-priv", method));
      const missing = await route(context("stranger", "no-existe", method));

      expect(priv.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(await priv.text()).toBe(await missing.text());
    },
  );

  it.each(["PUT", "DELETE"] as const)("%s de un ajeno sobre un nanobook público responde 403", async (method) => {
    const route = (await import("./index"))[method];

    expect((await route(context("stranger", "book-pub", method))).status).toBe(403);
  });
});
