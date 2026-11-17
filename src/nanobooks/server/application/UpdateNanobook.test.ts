import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError, createAuthorizer } from "../../../authorization/server";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { NanobookAccessPolicy } from "./access/NanobookAccessPolicy";
import { UpdateNanobook } from "./UpdateNanobook";

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
    update: new UpdateNanobook(repository, cache, authorizer),
  };
}

describe("UpdateNanobook", () => {
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
    const { update, repository } = setup("public");
    const result = await update.execute("other", "one", { name: "Changed" });
    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect((result.getError() as AccessDeniedError).decision).toEqual({ effect: "deny", reason: "forbidden" });
    expect((await repository.findById("one")).getValue()?.getName()).toBe("First");
  });

  it("answers not-found to a stranger on a private nanobook, same as for a missing one", async () => {
    const { update } = setup();
    const expected = { effect: "deny", reason: "not-found" };
    for (const result of [
      await update.execute("other", "one", { name: "Changed" }),
      await update.execute("other", "missing", { name: "Changed" }),
    ]) {
      expect(result.getError()).toBeInstanceOf(AccessDeniedError);
      expect((result.getError() as AccessDeniedError).decision).toEqual(expected);
    }
  });
});
