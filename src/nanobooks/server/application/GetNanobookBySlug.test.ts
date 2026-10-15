import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { GetNanobookBySlug } from "./GetNanobookBySlug";

describe("GetNanobookBySlug", () => {
  it("returns the nanobook resolved by its public slug", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
    }).getValue();
    const repository: NanobookRepository = {
      listPublic: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn().mockResolvedValue(Result.ok(nanobook)),
      listByOwner: vi.fn(),
      create: vi.fn(),
      updateSetupStatus: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const result = await new GetNanobookBySlug(repository).execute("manual");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBe(nanobook);
    expect(repository.findBySlug).toHaveBeenCalledWith("manual");
  });

  it("returns null when the slug is not registered", async () => {
    const repository: NanobookRepository = {
      listPublic: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn().mockResolvedValue(Result.ok(null)),
      listByOwner: vi.fn(),
      create: vi.fn(),
      updateSetupStatus: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const result = await new GetNanobookBySlug(repository).execute("missing");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toBeNull();
  });
});
