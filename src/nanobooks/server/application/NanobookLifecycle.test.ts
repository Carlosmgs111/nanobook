import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError, createAuthorizer } from "../../../authorization/server";
import { Nanobook } from "../domain/Nanobook";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { NanobookAccessPolicy } from "./NanobookAccessPolicy";
import { UpdateNanobook } from "./UpdateNanobook";
import { DeleteNanobook } from "./DeleteNanobook";
import type { NanobookReadCache } from "./NanobookReadCache";

function setup() {
  const book = Nanobook.create({ id: "one", ownerId: "owner", slug: "first", name: "First" }).getValue();
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
    update: new UpdateNanobook(repository, cache, authorizer),
    remove: new DeleteNanobook(repository, cache, authorizer),
  };
}

describe("nanobook lifecycle", () => {
  it("edits metadata while preserving identity", async () => {
    const { update, repository, cache } = setup();
    const result = await update.execute("owner", "one", { name: "Renamed", slug: "renamed", visibility: "public" });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().toPersistence()).toMatchObject({ id: "one", ownerId: "owner", name: "Renamed", slug: "renamed", visibility: "public" });
    expect((await repository.findBySlug("first")).getValue()).toBeNull();
    expect(cache.replace).toHaveBeenCalledWith(result.getValue(), "first");
  });

  it("rejects conflicting slugs and invalid input without changes", async () => {
    const { update, repository } = setup();
    expect((await update.execute("owner", "one", { slug: "second" })).getError().name).toBe("NanobookSlugAlreadyTakenError");
    for (const input of [{ name: " " }, { slug: "bad/slug" }, { visibility: "invalid" }, { ownerId: "other" }, null, { name: 3 }, {}]) {
      expect((await update.execute("owner", "one", input)).isSuccess).toBe(false);
    }
    expect((await repository.findById("one")).getValue()?.getName()).toBe("First");
  });

  it("allows only the owner to mutate even a public nanobook", async () => {
    const { update, remove, repository } = setup();
    await update.execute("owner", "one", { visibility: "public" });
    for (const result of [
      await update.execute("other", "one", { name: "Changed" }),
      await remove.execute("other", "one", "First"),
    ]) {
      expect(result.getError()).toBeInstanceOf(AccessDeniedError);
      expect((result.getError() as AccessDeniedError).decision).toEqual({ effect: "deny", reason: "forbidden" });
    }
    expect((await repository.findById("one")).getValue()).not.toBeNull();
  });

  it("answers not-found to a stranger on a private nanobook, same as for a missing one", async () => {
    const { update, remove } = setup();
    const expected = { effect: "deny", reason: "not-found" };
    for (const result of [
      await update.execute("other", "one", { name: "Changed" }),
      await update.execute("other", "missing", { name: "Changed" }),
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
