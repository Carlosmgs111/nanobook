import { describe, expect, it, vi } from "vitest";
import { Nanobook } from "../domain/Nanobook";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
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
  return {
    repository,
    cache,
    update: new UpdateNanobook(repository, cache),
    remove: new DeleteNanobook(repository, cache),
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
    expect((await update.execute("other", "one", { name: "Changed" })).getError().name).toBe("NanobookAccessDeniedError");
    expect((await remove.execute("other", "one", "First")).getError().name).toBe("NanobookAccessDeniedError");
    expect((await repository.findById("one")).getValue()).not.toBeNull();
  });

  it("requires exact name confirmation and deletes only the requested book", async () => {
    const { remove, repository, cache } = setup();
    expect((await remove.execute("owner", "one", "wrong")).isSuccess).toBe(false);
    expect((await remove.execute("owner", "one", "First")).isSuccess).toBe(true);
    expect((await repository.findById("one")).getValue()).toBeNull();
    expect((await repository.findById("two")).getValue()).not.toBeNull();
    expect(cache.remove).toHaveBeenCalledWith("first");
    expect((await remove.execute("owner", "one", "First")).getError().name).toBe("NanobookNotFoundError");
  });
});
