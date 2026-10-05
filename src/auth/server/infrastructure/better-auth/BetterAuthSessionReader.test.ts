import { describe, expect, it } from "vitest";

import { BetterAuthSessionReader } from "./BetterAuthSessionReader";

describe("BetterAuthSessionReader", () => {
  it("maps a Better Auth session to the application's authenticated user", async () => {
    const getSession = async ({ headers }: { headers: Headers }) => {
      expect(headers.get("cookie")).toBe("session=token");
      return {
        user: {
          id: "user-1",
          name: "Ada Lovelace",
          email: "ada@example.com",
        },
      };
    };

    const user = await new BetterAuthSessionReader({
      api: { getSession },
    }).getSession(new Headers({ cookie: "session=token" }));

    expect(user).toEqual({
      id: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
  });

  it("returns null when Better Auth does not provide a session", async () => {
    const user = await new BetterAuthSessionReader({
      api: { getSession: async () => null },
    }).getSession(new Headers());

    expect(user).toBeNull();
  });
});
