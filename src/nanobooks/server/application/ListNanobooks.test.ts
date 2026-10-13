import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Nanobook } from "../domain/Nanobook";
import type { NanobookRepository } from "../domain/ports/NanobookRepository";
import { ListNanobooks } from "./ListNanobooks";

describe("ListNanobooks", () => {
  it("lists only the authenticated owner's nanobooks", async () => {
    const repository: NanobookRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      listByOwner: vi.fn().mockResolvedValue(Result.ok([
        Nanobook.create({ id: "book-1", ownerId: "owner-1", slug: "manual", name: "Manual" }).getValue(),
      ])),
      create: vi.fn(),
    };

    const result = await new ListNanobooks(repository).execute("owner-1");

    expect(result.isSuccess).toBe(true);
    expect(repository.listByOwner).toHaveBeenCalledWith("owner-1");
    expect(result.getValue()[0]?.getSlug()).toBe("manual");
  });
});
