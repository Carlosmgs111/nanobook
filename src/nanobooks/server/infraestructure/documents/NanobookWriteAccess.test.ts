import { describe, expect, it, vi } from "vitest";

import { createAuthorizer } from "../../../../authorization/server";
import { DocumentRepositoryError, WriteAccessDeniedError } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { NanobookAccessPolicy } from "../../application/NanobookAccessPolicy";
import { Nanobook } from "../../domain/Nanobook";
import { NanobookRepositoryError } from "../../domain/errors";
import type { NanobookRepository } from "../../domain/ports/NanobookRepository";
import { InMemoryNanobookRepository } from "../repository/InMemoryNanobookRepository";
import { NanobookWriteAccess } from "./NanobookWriteAccess";

vi.mock("../../../../shared/infrastructure/database/drizzleDatabase", () => ({ db: {} }));

vi.mock("astro:env/server", () => ({
  GITHUB_TOKEN: undefined,
  BETTER_AUTH_SECRET: undefined,
  CACHE_BACKEND: "memory",
  REDIS_URL: undefined,
}));

function adapter(repository: NanobookRepository) {
  return new NanobookWriteAccess(createAuthorizer([new NanobookAccessPolicy(repository)]));
}

function book(id: string, visibility: "public" | "private") {
  return Nanobook.create({ id, ownerId: "owner", slug: id, name: id, visibility }).getValue();
}

describe("NanobookWriteAccess", () => {
  const repository = new InMemoryNanobookRepository([
    book("book-a", "public"),
    book("book-b", "private"),
  ]);

  it("allows the owner", async () => {
    const result = await adapter(repository).require("book-a", "owner");

    expect(result.isSuccess).toBe(true);
  });

  it("denies a stranger on a public nanobook", async () => {
    const result = await adapter(repository).require("book-a", "stranger");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
  });

  it("denies a stranger on a private nanobook", async () => {
    const result = await adapter(repository).require("book-b", "stranger");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
  });

  it("reports a missing nanobook as denied", async () => {
    const result = await adapter(repository).require("missing", "owner");

    expect(result.getError()).toBeInstanceOf(WriteAccessDeniedError);
  });

  it("reports repository failures as DocumentRepositoryError", async () => {
    const failing = {
      findById: async () => Result.fail(new NanobookRepositoryError("db caída")),
    } as unknown as NanobookRepository;

    const result = await adapter(failing).require("book-a", "owner");

    expect(result.getError()).toBeInstanceOf(DocumentRepositoryError);
  });
});
