import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import { Nanobook } from "../../domain/Nanobook";
import { ListNanobooksController } from "./ListNanobooksController";

describe("ListNanobooksController", () => {
  it("returns the authenticated owner's nanobooks as response data", async () => {
    const nanobook = Nanobook.create({
      id: "book-1",
      ownerId: "owner-1",
      slug: "manual",
      name: "Manual",
      visibility: "public",
    }).getValue();
    const execute = vi.fn().mockResolvedValue(Result.ok([nanobook]));
    const controller = new ListNanobooksController({ execute } as never);

    const response = await controller.handle({
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "book-1",
        slug: "manual",
        name: "Manual",
        visibility: "public",
      },
    ]);
  });

  it("rejects an anonymous request", async () => {
    const controller = new ListNanobooksController({ execute: vi.fn() } as never);

    const response = await controller.handle({ locals: {} } as never);

    expect(response.status).toBe(401);
  });
});
