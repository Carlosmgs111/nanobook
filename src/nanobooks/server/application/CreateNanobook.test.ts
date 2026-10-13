import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { CreateNanobook } from "./CreateNanobook";

describe("CreateNanobook", () => {
  it("creates a collection owned by the authenticated actor", async () => {
    const repository: NanobookRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      listByOwner: vi.fn(),
      create: vi.fn().mockResolvedValue(Result.ok()),
    };
    const result = await new CreateNanobook(repository).execute("owner-1", {
      slug: "architecture",
      name: "Architecture",
      visibility: "private",
    });

    expect(result.isSuccess).toBe(true);
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: "owner-1",
      slug: "architecture",
    }));
  });

  it("uses the atomic repository path when a root initializer is configured", async () => {
    const createAtomically = vi.fn().mockResolvedValue(Result.ok());
    const initializeRoot = vi.fn().mockResolvedValue(undefined);
    const repository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      listByOwner: vi.fn(),
      create: vi.fn(),
      createAtomically,
    } as unknown as NanobookRepository;

    const result = await new CreateNanobook(repository, initializeRoot).execute("owner-1", {
      slug: "atomic",
      name: "Atomic",
      visibility: "private",
    });

    expect(result.isSuccess).toBe(true);
    expect(createAtomically).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.any(String), slug: "atomic" }),
      initializeRoot,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
});
