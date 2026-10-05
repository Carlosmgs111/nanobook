import { describe, expect, it, vi } from "vitest";

import { GetAuthenticatedSession } from "./GetAuthenticatedSession";

describe("GetAuthenticatedSession", () => {
  it("returns the authenticated user resolved from the request headers", async () => {
    const headers = new Headers({ cookie: "session=token" });
    const sessionReader = {
      getSession: vi.fn().mockResolvedValue({
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    };

    const result = await new GetAuthenticatedSession(sessionReader).execute(headers);

    expect(result).toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(sessionReader.getSession).toHaveBeenCalledWith(headers);
  });
});
