import type { APIRoute } from "astro";
import { describe, expect, it, vi } from "vitest";

import { createAuthorizer } from "../../../../authorization/server";
import { Result } from "../../../../shared/domain/Result";
import { NanobookAccessPolicy } from "../../application/NanobookAccessPolicy";
import { Nanobook } from "../../domain/Nanobook";
import { NanobookRepositoryError } from "../../domain/errors";
import type { NanobookRepository } from "../../domain/ports/NanobookRepository";
import { InMemoryNanobookRepository } from "../repository/InMemoryNanobookRepository";
import {
  protectNanobookWriteMutation,
  withNanobookWriteAccess,
} from "./withNanobookWriteAccess";

function book(id: string, visibility: "public" | "private") {
  return Nanobook.create({
    id,
    ownerId: "owner-1",
    slug: id,
    name: id,
    visibility,
  }).getValue();
}

const authorizer = createAuthorizer([
  new NanobookAccessPolicy(
    new InMemoryNanobookRepository([book("book-1", "private"), book("book-pub", "public")]),
  ),
]);

function context(userId: string | undefined, nanobookId: string | null = "book-1") {
  return {
    request: new Request(`https://nanobook.test/api/nanobooks/${nanobookId}/documents/document-1`, {
      method: "POST",
    }),
    params: nanobookId === null ? {} : { nanobookId },
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
      authorizer,
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

  it("answers 401 without a session and never runs the mutation", async () => {
    const mutation = vi.fn<APIRoute>();

    const response = await withNanobookWriteAccess(authorizer, mutation)(context(undefined));

    expect(response.status).toBe(401);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("lets the nanobook owner reach the document mutation", async () => {
    const mutation = vi.fn<APIRoute>().mockResolvedValue(new Response(null, { status: 201 }));
    const requestContext = context("owner-1");

    const response = await withNanobookWriteAccess(authorizer, mutation)(requestContext);

    expect(response.status).toBe(201);
    expect(mutation).toHaveBeenCalledWith(requestContext);
  });

  it("answers 403 to a non-owner on a public nanobook", async () => {
    const mutation = vi.fn<APIRoute>();

    const response = await withNanobookWriteAccess(authorizer, mutation)(
      context("another-user", "book-pub"),
    );

    expect(response.status).toBe(403);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("answers 404 to a non-owner on a private nanobook", async () => {
    const mutation = vi.fn<APIRoute>();

    const response = await withNanobookWriteAccess(authorizer, mutation)(context("another-user"));

    expect(response.status).toBe(404);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("does not expose a missing nanobook to a document mutation", async () => {
    const mutation = vi.fn<APIRoute>();

    const response = await withNanobookWriteAccess(authorizer, mutation)(
      context("owner-1", "missing"),
    );

    expect(response.status).toBe(404);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("answers 500 when the repository fails", async () => {
    const failing = {
      findById: async () => Result.fail(new NanobookRepositoryError("db caída")),
    } as unknown as NanobookRepository;
    const mutation = vi.fn<APIRoute>();

    const response = await withNanobookWriteAccess(
      createAuthorizer([new NanobookAccessPolicy(failing)]),
      mutation,
    )(context("owner-1"));

    expect(response.status).toBe(500);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("answers 404 when the route has no nanobookId", async () => {
    const mutation = vi.fn<APIRoute>();

    const response = await withNanobookWriteAccess(authorizer, mutation)(
      context("owner-1", null),
    );

    expect(response.status).toBe(404);
    expect(mutation).not.toHaveBeenCalled();
  });
});
