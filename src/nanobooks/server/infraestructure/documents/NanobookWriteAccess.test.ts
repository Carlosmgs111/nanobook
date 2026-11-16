import { describe, expect, it, vi } from "vitest";

import { DocumentRepositoryError, WriteAccessDeniedError } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { NanobookAccessDeniedError } from "../../application/AuthorizeNanobook";
import { NanobookNotFoundError } from "../../application/errors";
import type { NanobookAccessRequirement } from "../../application/RequireNanobookAccess";
import { NanobookWriteAccess } from "./NanobookWriteAccess";

vi.mock("../../../../shared/infrastructure/database/drizzleDatabase", () => ({ db: {} }));

vi.mock("astro:env/server", () => ({
  GITHUB_TOKEN: undefined,
  BETTER_AUTH_SECRET: undefined,
  CACHE_BACKEND: "memory",
  REDIS_URL: undefined,
}));

function adapter(result: unknown) {
  const execute = vi.fn().mockResolvedValue(result);
  return { writeAccess: new NanobookWriteAccess({ execute } as unknown as NanobookAccessRequirement), execute };
}

describe("NanobookWriteAccess", () => {
  it("allows when the nanobook grants write permission", async () => {
    const { writeAccess, execute } = adapter(Result.ok({}));

    const result = await writeAccess.require("book-a", "user-1");

    expect(result.isSuccess).toBe(true);
    expect(execute).toHaveBeenCalledWith("user-1", "book-a", "write");
  });

  it("denies when the nanobook rejects the actor", async () => {
    const { writeAccess } = adapter(Result.fail(new NanobookAccessDeniedError("book-a", "write")));

    const result = await writeAccess.require("book-a", "user-1");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
  });

  it("reports a missing nanobook as denied", async () => {
    const { writeAccess } = adapter(Result.fail(new NanobookNotFoundError("book-a")));

    const result = await writeAccess.require("book-a", "user-1");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
  });

  it("reports repository failures as DocumentRepositoryError", async () => {
    const { writeAccess } = adapter(Result.fail(new Error("db down")));

    const result = await writeAccess.require("book-a", "user-1");

    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
  });
});
