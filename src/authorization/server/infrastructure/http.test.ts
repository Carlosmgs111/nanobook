import { describe, expect, it } from "vitest";

import { AccessCheckFailedError, AccessDeniedError } from "../domain/errors";
import { accessErrorResponse } from "./http";

describe("accessErrorResponse", () => {
  it.each([
    ["unauthenticated", 401],
    ["forbidden", 403],
    ["not-found", 404],
  ] as const)("traduce deny(%s) a %i", async (reason, status) => {
    const response = accessErrorResponse(new AccessDeniedError({ effect: "deny", reason }));

    expect(response.status).toBe(status);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(typeof (await response.json()).error).toBe("string");
  });

  it("traduce challenge a 401 indicando el tipo de reto", async () => {
    const response = accessErrorResponse(new AccessDeniedError({ effect: "challenge", kind: "password" }));

    expect(response.status).toBe(401);
    expect((await response.json()).challenge).toBe("password");
  });

  it("traduce un fallo técnico a 500 sin exponer la causa", async () => {
    const response = accessErrorResponse(new AccessCheckFailedError(new Error("secreto de la db")));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).not.toContain("secreto de la db");
  });
});
