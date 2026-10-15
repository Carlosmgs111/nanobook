import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { NanobookNotFoundError } from "./errors";
import { GetNanobookById } from "./GetNanobookById";

function createRepository(): NanobookRepository {
  return {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    listByOwner: vi.fn(),
    create: vi.fn(),
    updateSetupStatus: vi.fn(),
  };
}

describe("GetNanobookById", () => {
  it("returns the nanobook resolved by its id", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue(Result.ok(nanobook));

    const result = await new GetNanobookById(repository).execute("book-1");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBe(nanobook);
    expect(repository.findById).toHaveBeenCalledWith("book-1");
  });

  it("returns a not found application error when the id is absent", async () => {
    const repository = createRepository();
    vi.mocked(repository.findById).mockResolvedValue(Result.ok(null));

    const result = await new GetNanobookById(repository).execute("missing");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(NanobookNotFoundError);
  });
});
