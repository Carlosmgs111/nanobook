import { describe, expect, it } from "vitest";
import { Nanobook } from "../../domain/Nanobook";
import { InMemoryNanobookRepository } from "../repository/InMemoryNanobookRepository";
import { UpdateNanobook } from "../../application/UpdateNanobook";
import { DeleteNanobook } from "../../application/DeleteNanobook";
import type { NanobookReadCache } from "../../application/NanobookReadCache";
import { NanobookLifecycleController } from "./NanobookLifecycleController";

describe("NanobookLifecycleController", () => {
  const create = () => {
    const repository = new InMemoryNanobookRepository([Nanobook.create({ id: "one", ownerId: "owner", slug: "first", name: "First" }).getValue()]);
    const cache: NanobookReadCache = {
      getOrLoad: async (_slug, load) => load(),
      replace: async () => undefined,
      remove: async () => undefined,
    };
    return new NanobookLifecycleController(
      new UpdateNanobook(repository, cache),
      new DeleteNanobook(repository, cache),
    );
  };
  const context = (body: string, user = "owner", id = "one", method = "PATCH") => ({
    request: new Request("http://localhost/api/nanobooks/one", { method, body, headers: { "Content-Type": "application/json" } }),
    params: { nanobookId: id }, locals: { currentUserId: user },
  }) as any;

  it("maps authentication, authorization, missing books and invalid JSON", async () => {
    const controller = create();
    expect((await controller.update(context('{}', ''))).status).toBe(401);
    expect((await controller.update(context('{"name":"New"}', 'stranger'))).status).toBe(403);
    expect((await controller.update(context('{"name":"New"}', 'owner', 'missing'))).status).toBe(404);
    expect((await controller.update(context('{'))).status).toBe(400);
    expect((await controller.update(context('{"slug":"/"}'))).status).toBe(400);
  });
  it("returns updated metadata and requires deletion confirmation", async () => {
    const controller = create();
    const response = await controller.update(context('{"name":"New"}'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "one", name: "New" });
    expect((await controller.delete(context('{"confirmationName":"First"}', 'owner', 'one', 'DELETE'))).status).toBe(400);
    expect((await controller.delete(context('{"confirmationName":"New"}', 'owner', 'one', 'DELETE'))).status).toBe(204);
  });
});
