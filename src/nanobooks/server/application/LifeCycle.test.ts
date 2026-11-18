import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError, createAuthorizer } from "../../../authorization/server";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import { NanobookAccessPolicy } from "../infraestructure/access/NanobookAccessPolicy";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { LifeCycle } from "./LifeCycle";

function setup(visibility: "public" | "private" = "private") {
  const book = Nanobook.create({
    id: "one",
    ownerId: "owner",
    slug: "first",
    name: "First",
    visibility,
    settings: { theme: { kind: "official", id: "classic" } },
  }).getValue();
  const other = Nanobook.create({ id: "two", ownerId: "other", slug: "second", name: "Second" }).getValue();
  const repository = new InMemoryNanobookRepository([book, other]);
  const cache: NanobookReadCache = {
    getOrLoad: async (_slug, load) => load(),
    replace: vi.fn(),
    remove: vi.fn(),
  };
  const authorizer = createAuthorizer([new NanobookAccessPolicy(repository)]);
  return { repository, cache, lifeCycle: new LifeCycle(repository, cache, authorizer) };
}

const notFound = { effect: "deny", reason: "not-found" };

describe("LifeCycle.update", () => {
  it("edits metadata while preserving identity", async () => {
    const { lifeCycle, repository, cache } = setup();
    const result = await lifeCycle.update("owner", "one", { name: "Renamed", slug: "renamed", visibility: "public" });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().toPersistence()).toMatchObject({ id: "one", ownerId: "owner", name: "Renamed", slug: "renamed", visibility: "public" });
    expect((await repository.findBySlug("first")).getValue()).toBeNull();
    expect(cache.replace).toHaveBeenCalledWith(result.getValue(), "first");
  });

  it("rejects conflicting slugs and invalid input without changes", async () => {
    const { lifeCycle, repository } = setup();
    expect((await lifeCycle.update("owner", "one", { slug: "second" })).getError().name).toBe("NanobookSlugAlreadyTakenError");
    for (const input of [{ name: " " }, { slug: "bad/slug" }, { visibility: "invalid" }, { ownerId: "other" }, null, { name: 3 }, {}]) {
      expect((await lifeCycle.update("owner", "one", input)).isSuccess).toBe(false);
    }
    expect((await repository.findById("one")).getValue()?.getName()).toBe("First");
  });

  it("allows only the owner to mutate even a public nanobook", async () => {
    const { lifeCycle, repository } = setup("public");
    const result = await lifeCycle.update("other", "one", { name: "Changed" });
    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect((result.getError() as AccessDeniedError).decision).toEqual({ effect: "deny", reason: "forbidden" });
    expect((await repository.findById("one")).getValue()?.getName()).toBe("First");
  });

  it("answers not-found to a stranger on a private nanobook, same as for a missing one", async () => {
    const { lifeCycle } = setup();
    for (const result of [
      await lifeCycle.update("other", "one", { name: "Changed" }),
      await lifeCycle.update("other", "missing", { name: "Changed" }),
    ]) {
      expect(result.getError()).toBeInstanceOf(AccessDeniedError);
      expect((result.getError() as AccessDeniedError).decision).toEqual(notFound);
    }
  });
});

describe("LifeCycle.delete", () => {
  it("allows only the owner to delete even a public nanobook", async () => {
    const { lifeCycle, repository } = setup("public");
    const result = await lifeCycle.delete("other", "one", "First");
    expect(result.getError()).toBeInstanceOf(AccessDeniedError);
    expect((result.getError() as AccessDeniedError).decision).toEqual({ effect: "deny", reason: "forbidden" });
    expect((await repository.findById("one")).getValue()).not.toBeNull();
  });

  it("answers not-found to a stranger on a private nanobook, same as for a missing one", async () => {
    const { lifeCycle } = setup();
    for (const result of [
      await lifeCycle.delete("other", "one", "First"),
      await lifeCycle.delete("other", "missing", "First"),
    ]) {
      expect(result.getError()).toBeInstanceOf(AccessDeniedError);
      expect((result.getError() as AccessDeniedError).decision).toEqual(notFound);
    }
  });

  it("requires exact name confirmation and deletes only the requested book", async () => {
    const { lifeCycle, repository, cache } = setup();
    expect((await lifeCycle.delete("owner", "one", "wrong")).isSuccess).toBe(false);
    expect((await lifeCycle.delete("owner", "one", "First")).isSuccess).toBe(true);
    expect((await repository.findById("one")).getValue()).toBeNull();
    expect((await repository.findById("two")).getValue()).not.toBeNull();
    expect(cache.remove).toHaveBeenCalledWith("first");
    const again = await lifeCycle.delete("owner", "one", "First");
    expect(again.getError()).toBeInstanceOf(AccessDeniedError);
    expect((again.getError() as AccessDeniedError).decision).toEqual(notFound);
  });
});

describe("LifeCycle.setNanobookTheme", () => {
  it("requires ownership and stores a valid reference while preserving the aggregate", async () => {
    const { lifeCycle } = setup();
    expect((await lifeCycle.setNanobookTheme("other", "one", { kind: "official", id: "nanobook" })).isSuccess).toBe(false);
    const result = await lifeCycle.setNanobookTheme("owner", "one", { kind: "custom", id: "theme-1" });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getSettings()).toEqual({ theme: { kind: "custom", id: "theme-1" } });
    expect(result.getValue().getSlug()).toBe("first");
  });

  it("replaces the slug snapshot after changing the theme", async () => {
    const { lifeCycle, cache } = setup();
    const result = await lifeCycle.setNanobookTheme("owner", "one", { kind: "custom", id: "theme-1" });
    expect(result.isSuccess).toBe(true);
    expect(cache.replace).toHaveBeenCalledWith(result.getValue(), "first");
  });

  it("rejects malformed references", async () => {
    const { lifeCycle } = setup();
    const result = await lifeCycle.setNanobookTheme("owner", "one", { kind: "custom", id: "" } as never);
    expect(result.isSuccess).toBe(false);
  });

  it("gives a stranger on a private nanobook the same decision as for a missing one", async () => {
    const { lifeCycle } = setup();
    const reference = { kind: "official", id: "nanobook" } as const;
    for (const id of ["one", "missing"]) {
      const error = (await lifeCycle.setNanobookTheme("other", id, reference)).getError();
      expect(error).toBeInstanceOf(AccessDeniedError);
      expect((error as AccessDeniedError).decision).toEqual(notFound);
    }
  });
});
