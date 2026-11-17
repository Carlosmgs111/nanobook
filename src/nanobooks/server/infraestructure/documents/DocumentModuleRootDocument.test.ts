import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Nanobook } from "../../domain/Nanobook";
import { DocumentModuleRootDocument } from "./DocumentModuleRootDocument";

function createNanobook(): Nanobook {
  return Nanobook.create({
    id: "nb-1",
    ownerId: "owner-1",
    slug: "architecture",
    name: "Architecture",
    visibility: "private",
    settings: { theme: { kind: "official", id: "monocromo" } },
    setupStatus: "pending",
  }).getValue();
}

function setup(options: { rootExists?: boolean } = {}) {
  const executeRaw = vi.fn(async () => (options.rootExists ? {} : null));
  const execute = vi.fn(async () => Result.ok({}));
  const documentModule = {
    getDocument: { executeRaw },
    createDocument: { execute },
  } as any;
  return { executeRaw, execute, adapter: new DocumentModuleRootDocument(documentModule) };
}

describe("DocumentModuleRootDocument", () => {
  it("creates the root document when it does not exist", async () => {
    const { adapter, executeRaw, execute } = setup();

    const result = await adapter.ensure(createNanobook());

    expect(result.isSuccess).toBe(true);
    expect(executeRaw).toHaveBeenCalledWith("nb-1", "index");
    expect(execute).toHaveBeenCalledWith(
      "nb-1",
      {
        id: "root-nb-1",
        path: "index",
        title: "Architecture",
        description: "Architecture",
        content: "# Architecture\n",
        author: "owner-1",
      },
      "owner-1",
    );
  });

  it("does not create the root document when it already exists", async () => {
    const { adapter, execute } = setup({ rootExists: true });

    const result = await adapter.ensure(createNanobook());

    expect(result.isSuccess).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });

  it("propagates the createDocument failure", async () => {
    const { adapter, execute } = setup();
    const failure = new Error("root unavailable");
    execute.mockResolvedValueOnce(Result.fail(failure) as any);

    const result = await adapter.ensure(createNanobook());

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBe(failure);
  });

  it("turns an executeRaw exception into a failure", async () => {
    const { adapter, executeRaw, execute } = setup();
    executeRaw.mockRejectedValueOnce(new Error("boom"));

    const result = await adapter.ensure(createNanobook());

    expect(result.isSuccess).toBe(false);
    expect(result.getError().message).toBe("boom");
    expect(execute).not.toHaveBeenCalled();
  });
});
