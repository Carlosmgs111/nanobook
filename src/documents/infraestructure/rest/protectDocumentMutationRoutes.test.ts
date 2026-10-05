import type { APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";

import { protectDocumentMutationRoutes } from "./protectDocumentMutationRoutes";

describe("protectDocumentMutationRoutes", () => {
  it("decorates every externally exposed document mutation route", () => {
    const post = vi.fn() as unknown as APIRoute;
    const patch = vi.fn() as unknown as APIRoute;
    const remove = vi.fn() as unknown as APIRoute;
    const protector = {
      protect: vi.fn((handler: APIRoute) => handler),
    };

    const routes = protectDocumentMutationRoutes(protector, {
      POST: post,
      PATCH: patch,
      DELETE: remove,
    });

    expect(protector.protect).toHaveBeenNthCalledWith(1, post);
    expect(protector.protect).toHaveBeenNthCalledWith(2, patch);
    expect(protector.protect).toHaveBeenNthCalledWith(3, remove);
    expect(routes).toEqual({ POST: post, PATCH: patch, DELETE: remove });
  });
});
