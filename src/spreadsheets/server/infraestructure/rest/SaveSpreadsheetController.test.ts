import { describe, expect, it, vi } from "vitest";
import { AccessDeniedError } from "../../../../authorization/server";
import { Result } from "../../../../shared/domain/Result";
import { InvalidSheetError, SheetNotFoundError, SheetRevisionConflictError } from "../../domain/errors";
import { SaveSpreadsheetController } from "./SaveSpreadsheetController";

const body = { documentPath: "ventas", original: [["Sur", 98]], next: [["Sur", 105]] };

function call(result: Result<unknown, void>, { user = "writer", payload = body as unknown, params = { nanobookId: "book-a" } } = {}) {
  const useCase = { execute: vi.fn().mockResolvedValue(result) };
  const controller = new SaveSpreadsheetController(useCase as never);
  const request = new Request("http://localhost/api", { method: "PATCH", body: typeof payload === "string" ? payload : JSON.stringify(payload) });
  return controller.handle({ params, request, locals: { currentUserId: user } } as never).then((response) => ({ response, useCase }));
}

describe("SaveSpreadsheetController", () => {
  it("passes the command to the use case and answers 200", async () => {
    const { response, useCase } = await call(Result.ok());

    expect(response.status).toBe(200);
    expect(useCase.execute).toHaveBeenCalledWith({ nanobookId: "book-a", actorId: "writer", ...body });
  });

  it("requires a session", async () => {
    const { response, useCase } = await call(Result.ok(), { user: null as never });

    expect(response.status).toBe(401);
    expect(useCase.execute).not.toHaveBeenCalled();
  });

  it("rejects an invalid body", async () => {
    expect((await call(Result.ok(), { payload: "no es json" })).response.status).toBe(400);
    expect((await call(Result.ok(), { payload: { documentPath: "" } })).response.status).toBe(400);
  });

  it.each([
    [new SheetNotFoundError(), 409],
    [new SheetRevisionConflictError(), 409],
    [new InvalidSheetError("x"), 422],
    [new AccessDeniedError({ effect: "deny", reason: "forbidden" }), 403],
    [new Error("boom"), 500],
  ])("translates %o to %i", async (error, status) => {
    const { response } = await call(Result.fail(error));

    expect(response.status).toBe(status);
  });
});
