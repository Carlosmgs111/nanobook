import { describe, expect, it, vi } from "vitest";
import type { Authorizer } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import { NanobookNotFoundError, NanobookRepositoryError } from "../domain/errors";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { loadWritableNanobook, saveNanobook } from "./writableNanobook";

const book = () =>
  Nanobook.create({ id: "book-1", ownerId: "owner-1", slug: "book", name: "Book" }).getValue();

const repositoryWith = (overrides: Partial<NanobookRepository> = {}) =>
  ({
    findById: vi.fn(async () => Result.ok(book())),
    update: vi.fn(async () => Result.ok()),
    ...overrides,
  }) as unknown as NanobookRepository;

const authorizerAllowing = () =>
  ({ require: vi.fn(async () => Result.ok(undefined)) }) as unknown as Authorizer;

const cache = () =>
  ({ getOrLoad: vi.fn(), replace: vi.fn(), remove: vi.fn() }) as unknown as NanobookReadCache;

describe("loadWritableNanobook", () => {
  it("authorizes write on the nanobook for the user and loads it", async () => {
    const authorizer = authorizerAllowing();
    const repository = repositoryWith();

    const result = await loadWritableNanobook(authorizer, repository, "owner-1", "book-1");

    expect(result.getValue().toPersistence().id).toBe("book-1");
    const request = vi.mocked(authorizer.require).mock.calls[0][0];
    expect(await request.subject.userId()).toBe("owner-1");
    expect(request.action).toBe("write");
    expect(request.resource).toEqual({ type: "nanobook", id: "book-1" });
    expect(repository.findById).toHaveBeenCalledWith("book-1");
  });

  it("does not query the repository when authorization is denied", async () => {
    const denied = new Error("denied");
    const authorizer = { require: vi.fn(async () => Result.fail(denied)) } as unknown as Authorizer;
    const repository = repositoryWith();

    const result = await loadWritableNanobook(authorizer, repository, "stranger", "book-1");

    expect(result.getError()).toBe(denied);
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("fails with NanobookNotFoundError when it disappears after authorizing", async () => {
    const repository = repositoryWith({ findById: vi.fn(async () => Result.ok(null)) });

    const result = await loadWritableNanobook(authorizerAllowing(), repository, "owner-1", "gone");

    expect(result.getError()).toBeInstanceOf(NanobookNotFoundError);
  });

  it("propagates repository failures", async () => {
    const failure = new NanobookRepositoryError("boom");
    const repository = repositoryWith({ findById: vi.fn(async () => Result.fail(failure)) });

    const result = await loadWritableNanobook(authorizerAllowing(), repository, "owner-1", "book-1");

    expect(result.getError()).toBe(failure);
  });
});

describe("saveNanobook", () => {
  it("persists the merged aggregate and replaces the cache with the previous slug", async () => {
    const repository = repositoryWith();
    const readCache = cache();

    const result = await saveNanobook(repository, readCache, book(), { name: "Renamed", slug: "renamed" });

    const saved = result.getValue();
    expect(saved.getName()).toBe("Renamed");
    expect(saved.getSlug()).toBe("renamed");
    expect(saved.toPersistence().ownerId).toBe("owner-1");
    expect(repository.update).toHaveBeenCalledWith(saved);
    expect(readCache.replace).toHaveBeenCalledWith(saved, "book");
  });

  it("fails without touching repository or cache when the changes are invalid", async () => {
    const repository = repositoryWith();
    const readCache = cache();

    const result = await saveNanobook(repository, readCache, book(), { slug: "not a slug" });

    expect(result.isSuccess).toBe(false);
    expect(repository.update).not.toHaveBeenCalled();
    expect(readCache.replace).not.toHaveBeenCalled();
  });

  it("propagates persistence failures and leaves the cache untouched", async () => {
    const failure = new NanobookRepositoryError("boom");
    const repository = repositoryWith({ update: vi.fn(async () => Result.fail(failure)) });
    const readCache = cache();

    const result = await saveNanobook(repository, readCache, book(), { name: "Renamed" });

    expect(result.getError()).toBe(failure);
    expect(readCache.replace).not.toHaveBeenCalled();
  });
});
