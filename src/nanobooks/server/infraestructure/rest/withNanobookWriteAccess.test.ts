import type { APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import { Nanobook } from "../../domain/Nanobook";
import { NanobookAccessDeniedError } from "../../application/AuthorizeNanobook";
import { NanobookNotFoundError } from "../../application/errors";
import {
  protectNanobookWriteMutation,
  withNanobookWriteAccess,
} from "./withNanobookWriteAccess";

const ownedNanobook = Nanobook.create({
  id: "book-1",
  ownerId: "owner-1",
  slug: "owner-book",
  name: "Owner book",
}).getValue();

function context(userId: string, nanobookId = "book-1") {
  return {
    request: new Request(`https://nanobook.test/api/nanobooks/${nanobookId}/documents/document-1`, {
      method: "POST",
    }),
    params: { nanobookId },
    locals: { currentUserId: userId },
  } as Parameters<APIRoute>[0];
}

describe("withNanobookWriteAccess", () => {
  it("authenticates before checking nanobook ownership", async () => {
    const mutation = vi.fn<APIRoute>().mockResolvedValue(new Response(null, { status: 201 }));
    const route = protectNanobookWriteMutation(
      {
        protect: (handler) => async (requestContext) => {
          requestContext.locals.currentUserId = "owner-1";
          return handler(requestContext);
        },
      },
      {
        execute: async (actorId, nanobookId, permission) => {
          expect(actorId).toBe("owner-1");
          expect(nanobookId).toBe("book-1");
          expect(permission).toBe("write");
          return Result.ok(ownedNanobook);
        },
      },
      mutation,
    );

    const response = await route({
      request: new Request("https://nanobook.test/api/nanobooks/book-1/documents/document-1", {
        method: "POST",
        headers: { Origin: "https://nanobook.test" },
      }),
      params: { nanobookId: "book-1" },
      locals: {},
    } as Parameters<APIRoute>[0]);

    expect(response.status).toBe(201);
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it("rejects a signed-in non-owner before the document mutation runs", async () => {
    const mutation = vi.fn<APIRoute>().mockResolvedValue(new Response(null, { status: 201 }));
    const route = withNanobookWriteAccess(
      { execute: vi.fn().mockResolvedValue(Result.fail(new NanobookAccessDeniedError("book-1", "write"))) },
      mutation,
    );

    const response = await route(context("another-user"));

    expect(response.status).toBe(403);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("lets the nanobook owner reach the document mutation", async () => {
    const mutation = vi.fn<APIRoute>().mockResolvedValue(new Response(null, { status: 201 }));
    const route = withNanobookWriteAccess(
      { execute: vi.fn().mockResolvedValue(Result.ok(ownedNanobook)) },
      mutation,
    );
    const requestContext = context("owner-1");

    const response = await route(requestContext);

    expect(response.status).toBe(201);
    expect(mutation).toHaveBeenCalledWith(requestContext);
  });

  it("does not expose a missing nanobook to a document mutation", async () => {
    const mutation = vi.fn<APIRoute>().mockResolvedValue(new Response(null, { status: 201 }));
    const route = withNanobookWriteAccess(
      { execute: vi.fn().mockResolvedValue(Result.fail(new NanobookNotFoundError("missing"))) },
      mutation,
    );

    const response = await route(context("owner-1", "missing"));

    expect(response.status).toBe(404);
    expect(mutation).not.toHaveBeenCalled();
  });
});
