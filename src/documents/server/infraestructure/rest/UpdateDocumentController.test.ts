import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { DocumentNotFoundError, DocumentRevisionConflictError, WriteAccessDeniedError } from "../../domain/errors";
import { UpdateDocumentController } from "./UpdateDocumentController";

const updated = Document.create("intro", { id: "doc-1", title: "T", description: "D" }, "# T").getValue();
const body = { path: "intro", title: "T", description: "D", content: "# T" };

function call(execute: unknown, { locals = { currentUserId: "u1" }, payload = body as Record<string, unknown> } = {}) {
  return new UpdateDocumentController({ execute } as never).handle({
    params: { id: "doc-1", nanobookId: "book-a" },
    locals,
    request: new Request("https://nanobook.test/api", { method: "PATCH", body: JSON.stringify(payload) }),
  } as never) as Promise<Response>;
}

describe("UpdateDocumentController", () => {
  it("takes the identity from the route and drops forged fields", async () => {
    const execute = vi.fn().mockResolvedValue(Result.ok(updated));

    const response = await call(execute, { payload: { ...body, id: "forged", ownerId: "forged", expectedRevision: 4 } });

    expect(response.status).toBe(200);
    const [nanobookId, input, actorId] = execute.mock.calls[0];
    expect([nanobookId, actorId]).toEqual(["book-a", "u1"]);
    expect(input).toMatchObject({ id: "doc-1", expectedRevision: 4, path: "intro" });
    expect(input).not.toHaveProperty("ownerId");
  });

  it("ignores a non numeric expectedRevision", async () => {
    const execute = vi.fn().mockResolvedValue(Result.ok(updated));

    await call(execute, { payload: { ...body, expectedRevision: "4" } });

    expect(execute.mock.calls[0][1].expectedRevision).toBeUndefined();
  });

  it("rejects an anonymous request and a payload without path", async () => {
    const execute = vi.fn();

    expect((await call(execute, { locals: {} as never })).status).toBe(401);
    expect((await call(execute, { payload: { title: "T" } })).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps 403, 404 and revision conflicts", async () => {
    const respond = (error: Error) => call(vi.fn().mockResolvedValue(Result.fail(error)));

    expect((await respond(new WriteAccessDeniedError("book-a"))).status).toBe(403);
    expect((await respond(new DocumentNotFoundError("doc-1"))).status).toBe(404);
    const conflict = await respond(new DocumentRevisionConflictError("doc-1", 1, 2));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ expectedRevision: 1, actualRevision: 2 });
  });
});
