import { beforeEach, describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import type { Nanobook } from "../domain/Nanobook";
import { CreateNanobook } from "./CreateNanobook";
import type { NanobookReadCache } from "../domain/ports/NanobookReadCache";
import type { NanobookRootDocument } from "../domain/ports/NanobookRootDocument";

function createCache(): NanobookReadCache {
  return {
    getOrLoad: async (_slug, load) => load(),
    replace: vi.fn(),
    remove: vi.fn(),
  };
}

function setupRootDocument(options: { failFirstRoot?: boolean } = {}) {
  let failFirstRoot = options.failFirstRoot ?? false;

  return {
    ensure: vi.fn(async (_nanobook: Nanobook): Promise<Result<Error, void>> => {
      if (failFirstRoot) {
        failFirstRoot = false;
        return Result.fail(new Error("root unavailable"));
      }
      return Result.ok();
    }),
  } satisfies NanobookRootDocument;
}

describe("CreateNanobook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the nanobook and its root document", async () => {
    const rootDocument = setupRootDocument();
    const repository = new InMemoryNanobookRepository();

    const result = await new CreateNanobook(repository, rootDocument, createCache()).execute(
      "owner-1",
      {
        slug: "architecture",
        name: "Architecture",
        visibility: "private",
      },
    );

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getSetupStatus()).toBe("ready");
    expect(result.getValue().getSettings()).toEqual({
      theme: { kind: "official", id: "monocromo" },
    });
    expect(rootDocument.ensure).toHaveBeenCalledTimes(1);
    expect(rootDocument.ensure.mock.calls[0]![0].getId()).toBe(
      result.getValue().getId(),
    );
    expect(
      (await repository.findBySlug("architecture")).getValue()?.getSetupStatus(),
    ).toBe("ready");
  });

  it("caches only the ready nanobook after its root document exists", async () => {
    const rootDocument = setupRootDocument();
    const repository = new InMemoryNanobookRepository();
    const cache: NanobookReadCache = {
      getOrLoad: async (_slug, load) => load(),
      replace: vi.fn(),
      remove: vi.fn(),
    };

    const result = await new CreateNanobook(repository, rootDocument, cache).execute(
      "owner-1",
      { slug: "architecture", name: "Architecture", visibility: "private" },
    );

    expect(result.isSuccess).toBe(true);
    expect(cache.replace).toHaveBeenCalledWith(result.getValue());
    expect(result.getValue().getSetupStatus()).toBe("ready");
  });

  it("resumes a failed root creation on retry", async () => {
    const rootDocument = setupRootDocument({ failFirstRoot: true });
    const repository = new InMemoryNanobookRepository();
    const create = new CreateNanobook(repository, rootDocument, createCache());

    const first = await create.execute("owner-1", {
      slug: "architecture",
      name: "Architecture",
      visibility: "private",
    });
    const second = await create.execute("owner-1", {
      slug: "architecture",
      name: "Architecture",
      visibility: "private",
    });

    expect(first.isSuccess).toBe(false);
    expect(
      (await repository.findBySlug("architecture")).getValue()?.getSetupStatus(),
    ).toBe("ready");
    expect(second.isSuccess).toBe(true);
  });

  it("propagates repository failures before creating a nanobook", async () => {
    const rootDocument = setupRootDocument();
    const failure = new Error("lookup failed");
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(Result.fail(failure)),
      create: vi.fn(),
      updateSetupStatus: vi.fn(),
    };

    const result = await new CreateNanobook(repository, rootDocument, createCache()).execute(
      "owner-1",
      {
        slug: "atomic",
        name: "Atomic",
        visibility: "private",
      },
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBe(failure);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
