import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { DocumentAlreadyExistsError, ParentNotFoundError, WriteAccessDeniedError } from "../../domain/errors";
import { CreateDocumentController } from "./CreateDocumentController";

const created = Document.create("intro", {
  id: "doc-1",
  title: "T",
  description: "D",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
}, "# T").getValue();

const payload = { id: "doc-1", path: "intro", title: "T", description: "D", content: "# T" };

function call(execute: unknown, { params = { id: "doc-1", nanobookId: "book-a" }, locals = { currentUserId: "u1" }, body = payload } = {}) {
  return new CreateDocumentController({ execute } as never).handle({
    params,
    locals,
    request: new Request("https://nanobook.test/api", { method: "POST", body: JSON.stringify(body) }),
  } as never) as Promise<Response>;
}

describe("CreateDocumentController", () => {
  it("answers 201 with the serialized document and forwards only editable fields and the session actor", async () => {
    const execute = vi.fn().mockResolvedValue(Result.ok(created));

    const response = await call(execute, { body: { ...payload, ownerId: "forged", createdAt: "2000-01-01" } as never });

    expect(response.status).toBe(201);
    expect((await response.json()).metadata.createdAt).toBe("2026-01-01T00:00:00.000Z");
    const [nanobookId, input, actorId] = execute.mock.calls[0];
    expect([nanobookId, actorId]).toEqual(["book-a", "u1"]);
    expect(input).toMatchObject({ id: "doc-1", path: "intro" });
    expect(input).not.toHaveProperty("ownerId");
    expect(input.createdAt).toBeUndefined();
  });

  it("rejects an anonymous request and an id that differs from the route", async () => {
    const execute = vi.fn();

    expect((await call(execute, { locals: {} as never })).status).toBe(401);
    expect((await call(execute, { body: { ...payload, id: "other" } })).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps domain errors to HTTP statuses", async () => {
    const statusFor = async (error: Error) => (await call(vi.fn().mockResolvedValue(Result.fail(error)))).status;

    expect(await statusFor(new WriteAccessDeniedError("book-a"))).toBe(403);
    expect(await statusFor(new DocumentAlreadyExistsError("intro"))).toBe(409);
    expect(await statusFor(new ParentNotFoundError("guide"))).toBe(400);
  });
});
