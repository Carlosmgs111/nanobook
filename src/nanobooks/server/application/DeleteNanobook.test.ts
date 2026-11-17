import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError, createAuthorizer } from "../../../authorization/server";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { NanobookAccessPolicy } from "./access/NanobookAccessPolicy";
import { DeleteNanobook } from "./DeleteNanobook";

function setup(visibility: "public" | "private" = "private") {
  const book = Nanobook.create({ id: "one", ownerId: "owner", slug: "first", name: "First", visibility }).getValue();
  const other = Nanobook.create({ id: "two", ownerId: "other", slug: "second", name: "Second" }).getValue();
  const repository = new InMemoryNanobookRepository([book, other]);
  const cache: NanobookReadCache = {
    getOrLoad: async (_slug, load) => load(),
    replace: vi.fn(),
    remove: vi.fn(),
  };
  const authorizer = createAuthorizer([new NanobookAccessPolicy(repository)]);
  return {
    repository,
    cache,
    remove: new DeleteNanobook(repository, cache, authorizer),
  };
}

describe("DeleteNanobook", () => {
  it("allows only the owner to delete even a public nanobook", async () => {
    const { remove, repository } = setup("public");
    const result = await remove.execute("other", "one", "First");
    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect((result.getError() as AccessDeniedError).decision).toEqual({ effect: "deny", reason: "forbidden" });
    expect((await repository.findById("one")).getValue()).not.toBeNull();
  });

  it("answers not-found to a stranger on a private nanobook, same as for a missing one", async () => {
    const { remove } = setup();
    const expected = { effect: "deny", reason: "not-found" };
    for (const result of [
      await remove.execute("other", "one", "First"),
      await remove.execute("other", "missing", "First"),
    ]) {
      expect(result.getError()).toBeInstanceOf(AccessDeniedError);
      expect((result.getError() as AccessDeniedError).decision).toEqual(expected);
    }
  });

  it("requires exact name confirmation and deletes only the requested book", async () => {
    const { remove, repository, cache } = setup();
    expect((await remove.execute("owner", "one", "wrong")).isSuccess).toBe(false);
    expect((await remove.execute("owner", "one", "First")).isSuccess).toBe(true);
    expect((await repository.findById("one")).getValue()).toBeNull();
    expect((await repository.findById("two")).getValue()).not.toBeNull();
    expect(cache.remove).toHaveBeenCalledWith("first");
    const again = await remove.execute("owner", "one", "First");
    expect(again.getError()).toBeInstanceOf(AccessDeniedError);
    expect((again.getError() as AccessDeniedError).decision).toEqual({ effect: "deny", reason: "not-found" });
  });
});
