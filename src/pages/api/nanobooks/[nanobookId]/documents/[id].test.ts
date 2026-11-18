import type { APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createAuthorizer } from "../../../../../authorization/server";
import { CreateDocument } from "../../../../../documents/server/application/CreateDocument";
import { DeleteDocument } from "../../../../../documents/server/application/DeleteDocument";
import { UpdateDocument } from "../../../../../documents/server/application/UpdateDocument";
import { CreateDocumentController } from "../../../../../documents/server/infraestructure/rest/CreateDocumentController";
import { DeleteDocumentController } from "../../../../../documents/server/infraestructure/rest/DeleteDocumentController";
import { UpdateDocumentController } from "../../../../../documents/server/infraestructure/rest/UpdateDocumentController";
import { NanobookAccessPolicy } from "../../../../../nanobooks/server/infraestructure/access/NanobookAccessPolicy";
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

const repository = {
  list: vi.fn(),
  getById: vi.fn().mockResolvedValue(Result.ok(null)),
  getByPath: vi.fn().mockResolvedValue(Result.ok(null)),
  getByPublicPath: vi.fn(),
  create: vi.fn().mockResolvedValue(Result.ok()),
  updateMany: vi.fn().mockResolvedValue(Result.ok()),
  deleteMany: vi.fn().mockResolvedValue(Result.ok()),
};
const eventBus = { publish: vi.fn().mockResolvedValue(Result.ok()), subscribe: vi.fn() };

// La aplicación compuesta no expone ningún autorizador a las rutas: la decisión vive en los casos de uso.
const protect = vi.fn((handler: APIRoute) => handler);
vi.mock("../../../../../application/server/Application", () => ({
  getApp: async () => ({
    routeProtector: { protect },
    nanobookModule: {
      documentModule: {
        createDocumentController: new CreateDocumentController(new CreateDocument(repository as never, eventBus, authorizer)),
        updateDocumentController: new UpdateDocumentController(new UpdateDocument(repository as never, eventBus, authorizer)),
        deleteDocumentController: new DeleteDocumentController(new DeleteDocument(repository as never, eventBus, authorizer)),
      },
    },
  }),
}));

const payload = { id: "doc-1", path: "intro", title: "T", description: "D", content: "# T" };

function context(userId: string | undefined, nanobookId: string, method: string) {
  return {
    request: new Request(`https://nanobook.test/api/nanobooks/${nanobookId}/documents/doc-1`, {
      method,
      body: method === "DELETE" ? undefined : JSON.stringify(payload),
    }),
    params: { nanobookId, id: "doc-1" },
    locals: { currentUserId: userId },
  } as unknown as Parameters<APIRoute>[0];
}

describe("rutas de mutación de documentos sin guard", () => {
  it("protege cada método solo con el RouteProtector", async () => {
    await import("./[id]");

    expect(protect).toHaveBeenCalledTimes(3);
  });

  it.each(["POST", "PATCH", "DELETE"] as const)("%s sin sesión responde 401", async (method) => {
    const route = (await import("./[id]"))[method];

    expect((await route(context(undefined, "book-priv", method))).status).toBe(401);
  });

  it.each(["POST", "PATCH", "DELETE"] as const)(
    "%s de un ajeno sobre un nanobook privado y sobre uno inexistente responde el mismo 404",
    async (method) => {
      const route = (await import("./[id]"))[method];

      const priv = await route(context("stranger", "book-priv", method));
      const missing = await route(context("stranger", "no-existe", method));

      expect(priv.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(await priv.text()).toBe(await missing.text());
    },
  );

  it.each(["POST", "PATCH", "DELETE"] as const)("%s de un ajeno sobre un nanobook público responde 403", async (method) => {
    const route = (await import("./[id]"))[method];

    expect((await route(context("stranger", "book-pub", method))).status).toBe(403);
  });
});
