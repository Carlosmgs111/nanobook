import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import { NanobookNotFoundError } from "../domain/errors";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { Reading } from "./Reading";

const passthroughCache = (): NanobookReadCache => ({
  getOrLoad: (_slug, load) => load(),
  replace: vi.fn(),
  remove: vi.fn(),
});

const repositoryDouble = (overrides: Partial<NanobookRepository>): NanobookRepository => ({
  listPublic: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  listByOwner: vi.fn(),
  create: vi.fn(),
  updateSetupStatus: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  ...overrides,
});

const manual = () => Nanobook.create({ id: "book-1", ownerId: "owner-1", slug: "manual", name: "Manual" }).getValue();

describe("Reading.getNanobookById", () => {
  const book = Nanobook.create({ id: "one", ownerId: "owner", slug: "one", name: "One" }).getValue();

  it("devuelve el nanobook", async () => {
    const reading = new Reading(new InMemoryNanobookRepository([book]), passthroughCache());

    expect((await reading.getNanobookById("one")).getValue()).toBe(book);
  });

  it("falla con NanobookNotFoundError si no existe", async () => {
    const reading = new Reading(new InMemoryNanobookRepository([book]), passthroughCache());

    expect((await reading.getNanobookById("zzz")).getError()).toBeInstanceOf(NanobookNotFoundError);
  });
});

describe("Reading.getNanobookBySlug", () => {
  it("returns the nanobook resolved by its public slug", async () => {
    const nanobook = manual();
    const repository = repositoryDouble({ findBySlug: vi.fn().mockResolvedValue(Result.ok(nanobook)) });

    const result = await new Reading(repository, passthroughCache()).getNanobookBySlug("manual");

    expect(result.getValue()).toBe(nanobook);
    expect(repository.findBySlug).toHaveBeenCalledWith("manual");
  });

  it("returns null when the slug is not registered", async () => {
    const repository = repositoryDouble({ findBySlug: vi.fn().mockResolvedValue(Result.ok(null)) });

    const result = await new Reading(repository, passthroughCache()).getNanobookBySlug("missing");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
  });

  it("returns a cached result without querying the repository", async () => {
    const nanobook = manual();
    const repository = repositoryDouble({});
    const cache: NanobookReadCache = {
      getOrLoad: vi.fn(async () => Result.ok(nanobook)),
      replace: vi.fn(),
      remove: vi.fn(),
    };

    const result = await new Reading(repository, cache).getNanobookBySlug("manual");

    expect(result.getValue()).toBe(nanobook);
    expect(cache.getOrLoad).toHaveBeenCalledWith("manual", expect.any(Function));
    expect(repository.findBySlug).not.toHaveBeenCalled();
  });
});

describe("Reading.listNanobooks", () => {
  it("lists only the authenticated owner's nanobooks", async () => {
    const repository = repositoryDouble({ listByOwner: vi.fn().mockResolvedValue(Result.ok([manual()])) });

    const result = await new Reading(repository, passthroughCache()).listNanobooks("owner-1");

    expect(repository.listByOwner).toHaveBeenCalledWith("owner-1");
    expect(result.getValue()[0]?.getSlug()).toBe("manual");
  });
});

describe("Reading.listPublicNanobooks", () => {
  it("provides public catalog fields without exposing ownership or settings", async () => {
    const repository = new InMemoryNanobookRepository([
      Nanobook.create({ id: "one", ownerId: "owner", name: "Manual", slug: "manual", visibility: "public" }).getValue(),
      Nanobook.create({ id: "two", ownerId: "owner", name: "Secret", slug: "secret" }).getValue(),
      Nanobook.create({ id: "three", ownerId: "owner", name: "Pending", slug: "pending", visibility: "public", setupStatus: "pending" }).getValue(),
    ]);

    const result = await new Reading(repository, passthroughCache()).listPublicNanobooks();

    expect(result.getValue()).toEqual([{ name: "Manual", slug: "manual" }]);
  });
});
