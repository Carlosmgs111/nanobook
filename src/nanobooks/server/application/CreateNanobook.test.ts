import { beforeEach, describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { InMemoryNanobookRepository } from "../infraestructure/repository/InMemoryNanobookRepository";
import { CreateNanobook } from "./CreateNanobook";

function setupDocumentModule(options: { failFirstRoot?: boolean } = {}) {
  let rootExists = false;
  let failFirstRoot = options.failFirstRoot ?? false;

  const executeRaw = vi.fn(async () => (rootExists ? {} : null));
  const create = vi.fn(async () => {
    if (failFirstRoot) {
      failFirstRoot = false;
      return Result.fail(new Error("root unavailable"));
    }
    rootExists = true;
    return Result.ok({});
  });

  return {
    getDocument: {
      executeRaw,
    },
    createDocument: {
      execute: create,
    },
  } as any;
}

describe("CreateNanobook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the nanobook and its root document", async () => {
    const documentModule = setupDocumentModule();
    const repository = new InMemoryNanobookRepository();

    const result = await new CreateNanobook(repository, documentModule).execute(
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
      theme: { kind: "official", id: "nanobook" },
    });
    expect(documentModule.getDocument.executeRaw).toHaveBeenCalledWith(
      result.getValue().getId(),
      "index",
    );
    expect(documentModule.createDocument.execute).toHaveBeenCalledWith(
      result.getValue().getId(),
      expect.objectContaining({ path: "index" }),
    );
    expect(
      (await repository.findBySlug("architecture")).getValue()?.getSetupStatus(),
    ).toBe("ready");
  });

  it("resumes a failed root creation on retry", async () => {
    const documentModule = setupDocumentModule({ failFirstRoot: true });
    const repository = new InMemoryNanobookRepository();
    const create = new CreateNanobook(repository, documentModule);

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
    const documentModule = setupDocumentModule();
    const failure = new Error("lookup failed");
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(Result.fail(failure)),
      create: vi.fn(),
      updateSetupStatus: vi.fn(),
    };

    const result = await new CreateNanobook(repository, documentModule).execute(
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
