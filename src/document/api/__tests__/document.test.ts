import { describe, it, expect } from "vitest";
import { createPatchHandler, createPostHandler } from "../document";
import { MemoryRepository } from "../../adapters/repository/memory-repository";
import { buildNewDocument } from "../../adapters/repository/document-builder";

describe("document API handlers", () => {
  describe("POST create", () => {
    it("crea un documento nuevo y devuelve 201", async () => {
      const repository = new MemoryRepository([
        buildNewDocument("blog/index", {
          title: "Blog",
          description: "Índice",
        }),
      ]);
      const handler = createPostHandler(repository);

      const response = await handler({
        request: new Request("http://localhost/api/documents", {
          method: "POST",
          body: JSON.stringify({
            id: "blog/post",
            title: "Post",
            description: "Descripción",
          }),
        }),
      } as any);

      expect(response.status).toBe(201);
      const document = await response.json();
      expect(document.id).toBe("blog/post");
    });

    it("rechaza ids inválidos con 400", async () => {
      const repository = new MemoryRepository();
      const handler = createPostHandler(repository);

      const response = await handler({
        request: new Request("http://localhost/api/documents", {
          method: "POST",
          body: JSON.stringify({
            id: "../secret",
            title: "Post",
            description: "Desc",
          }),
        }),
      } as any);

      expect(response.status).toBe(400);
    });

    it("devuelve 409 si el documento ya existe", async () => {
      const repository = new MemoryRepository([
        buildNewDocument("blog/post", {
          title: "Post",
          description: "Desc",
        }),
      ]);
      const handler = createPostHandler(repository);

      const response = await handler({
        request: new Request("http://localhost/api/documents", {
          method: "POST",
          body: JSON.stringify({
            id: "blog/post",
            title: "Post",
            description: "Desc",
          }),
        }),
      } as any);

      expect(response.status).toBe(409);
    });

    it("devuelve 400 si el padre no existe", async () => {
      const repository = new MemoryRepository();
      const handler = createPostHandler(repository);

      const response = await handler({
        request: new Request("http://localhost/api/documents", {
          method: "POST",
          body: JSON.stringify({
            id: "blog/post",
            title: "Post",
            description: "Desc",
          }),
        }),
      } as any);

      expect(response.status).toBe(400);
    });

    it("devuelve 400 si el padre no es un índice", async () => {
      const repository = new MemoryRepository([
        buildNewDocument("blog/post", {
          title: "Post",
          description: "Desc",
        }),
      ]);
      const handler = createPostHandler(repository);

      const response = await handler({
        request: new Request("http://localhost/api/documents", {
          method: "POST",
          body: JSON.stringify({
            id: "blog/post/hijo",
            title: "Hijo",
            description: "Desc",
          }),
        }),
      } as any);

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH update", () => {
    it("actualiza un documento existente", async () => {
      const repository = new MemoryRepository([
        buildNewDocument("blog/post", {
          title: "Post",
          description: "Desc",
        }),
      ]);
      const handler = createPatchHandler(repository);
      const updated = buildNewDocument("blog/post", {
        title: "Post actualizado",
        description: "Desc actualizada",
      });
      updated.content = "Nuevo contenido";

      const response = await handler({
        params: { slug: "blog/post" },
        request: new Request("http://localhost/api/blog/post", {
          method: "PATCH",
          body: JSON.stringify(updated),
        }),
      } as any);

      expect(response.status).toBe(200);
    });

    it("devuelve 404 si el documento no existe", async () => {
      const repository = new MemoryRepository();
      const handler = createPatchHandler(repository);
      const document = buildNewDocument("blog/post", {
        title: "Post",
        description: "Desc",
      });

      const response = await handler({
        params: { slug: "blog/post" },
        request: new Request("http://localhost/api/blog/post", {
          method: "PATCH",
          body: JSON.stringify(document),
        }),
      } as any);

      expect(response.status).toBe(404);
    });

    it("devuelve 400 si el slug no coincide con el id", async () => {
      const repository = new MemoryRepository();
      const handler = createPatchHandler(repository);
      const document = buildNewDocument("blog/post", {
        title: "Post",
        description: "Desc",
      });

      const response = await handler({
        params: { slug: "otro/post" },
        request: new Request("http://localhost/api/otro/post", {
          method: "PATCH",
          body: JSON.stringify(document),
        }),
      } as any);

      expect(response.status).toBe(400);
    });
  });
});
