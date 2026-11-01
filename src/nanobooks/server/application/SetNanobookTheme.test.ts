import { describe, expect, it, vi } from "vitest";
import { Nanobook } from "../domain/Nanobook";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { SetNanobookTheme } from "./SetNanobookTheme";
import type { NanobookReadCache } from "./NanobookReadCache";

const book = () => Nanobook.create({ id: "book-1", ownerId: "owner-1", slug: "book", name: "Book", settings: { theme: { kind: "official", id: "classic" } } }).getValue();

const cache = (): NanobookReadCache => ({
  getOrLoad: async (_slug, load) => load(),
  replace: vi.fn(),
  remove: vi.fn(),
});

describe("SetNanobookTheme", () => {
  it("requires ownership and stores a valid reference while preserving the aggregate", async () => {
    const repository = new InMemoryNanobookRepository([book()]);
    const set = new SetNanobookTheme(repository, cache());
    expect((await set.execute("owner-2", "book-1", { kind: "official", id: "nanobook" })).isSuccess).toBe(false);
    const result = await set.execute("owner-1", "book-1", { kind: "custom", id: "theme-1" });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getSettings()).toEqual({ theme: { kind: "custom", id: "theme-1" } });
    expect(result.getValue().getSlug()).toBe("book");
  });

  it("replaces the slug snapshot after changing the theme", async () => {
    const cache: NanobookReadCache = {
      getOrLoad: async (_slug, load) => load(),
      replace: vi.fn(),
      remove: vi.fn(),
    };
    const set = new SetNanobookTheme(
      new InMemoryNanobookRepository([book()]),
      cache,
    );

    const result = await set.execute("owner-1", "book-1", {
      kind: "custom",
      id: "theme-1",
    });

    expect(result.isSuccess).toBe(true);
    expect(cache.replace).toHaveBeenCalledWith(result.getValue(), "book");
  });

  it("rejects malformed references", async () => {
    const result = await new SetNanobookTheme(new InMemoryNanobookRepository([book()]), cache())
      .execute("owner-1", "book-1", { kind: "custom", id: "" } as never);
    expect(result.isSuccess).toBe(false);
  });
});
