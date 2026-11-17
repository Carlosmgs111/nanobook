import { describe, expect, it, vi } from "vitest";
import { AccessCheckFailedError, AccessDeniedError } from "../../../../authorization/server";
import { Result } from "../../../../shared/domain/Result";
import { DocumentNotFoundError } from "../../domain/errors";
import { DeleteDocumentController } from "./DeleteDocumentController";

function call(execute: unknown, { params = { id: "doc-1", nanobookId: "book-a" }, locals = { currentUserId: "u1" } } = {}) {
  return new DeleteDocumentController({ execute } as never).handle({ params, locals } as never) as Promise<Response>;
}

describe("DeleteDocumentController", () => {
  it("deletes on behalf of the session user", async () => {
    const execute = vi.fn().mockResolvedValue(Result.ok());

    const response = await call(execute);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledWith("book-a", "doc-1", "u1");
  });

  it("rejects an anonymous request and missing route params", async () => {
    const execute = vi.fn();

    expect((await call(execute, { locals: {} as never })).status).toBe(401);
    expect((await call(execute, { params: { nanobookId: "book-a" } as never })).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps a foreign author to 403 and a missing document to 404", async () => {
    const respond = (error: Error) => call(vi.fn().mockResolvedValue(Result.fail(error)));

    expect((await respond(new AccessDeniedError({ effect: "deny", reason: "forbidden" }))).status).toBe(403);
    expect((await respond(new AccessDeniedError({ effect: "deny", reason: "not-found" }))).status).toBe(404);
    expect((await respond(new AccessDeniedError({ effect: "deny", reason: "unauthenticated" }))).status).toBe(401);
    const failed = await respond(new AccessCheckFailedError(new Error("secret db detail")));
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain("secret db detail");
    expect((await respond(new DocumentNotFoundError("doc-1"))).status).toBe(404);
  });

  it("answers 500 when the use case throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await call(vi.fn().mockRejectedValue(new Error("boom")))).status).toBe(500);
    spy.mockRestore();
  });
});
