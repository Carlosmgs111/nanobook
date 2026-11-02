import { describe, expect, it } from "vitest";

import { BetterAuthSessionReader } from "./BetterAuthSessionReader";

describe("BetterAuthSessionReader", () => {
  it("maps a Better Auth session to the application's authenticated user", async () => {
    const getSession = async ({
      headers,
      query,
    }: {
      headers: Headers;
      query?: { disableCookieCache: true };
    }) => {
      expect(headers.get("cookie")).toBe("session=token");
      expect(query).toBeUndefined();
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

  it("bypasses the cookie cache when a read requires the authoritative session", async () => {
    const reader = new BetterAuthSessionReader({
      api: {
        getSession: async ({ query }: { headers: Headers; query?: { disableCookieCache: true } }) => {
          expect(query).toEqual({ disableCookieCache: true });
          return {
            user: {
              id: "user-1",
              name: "Ada Lovelace",
              email: "ada@example.com",
            },
          };
        },
      },
    });

    const user = await reader.getSession(
      new Headers({ cookie: "session=token" }),
      { forceDatabase: true },
    );

    expect(user).toMatchObject({ id: "user-1" });
  });

  it("forwards the refreshed session cookie from a page read to the browser", async () => {
    const reader = new BetterAuthSessionReader({
      api: { getSession: async () => null },
      handler: async (request: Request) => {
        expect(request.url).toBe("https://nanobook.test/api/auth/get-session");
        return new Response(
          JSON.stringify({
            user: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
          }),
          { headers: { "Set-Cookie": "better-auth.session_data=renewed; Path=/; HttpOnly" } },
        );
      },
    });
    const responseHeaders = new Headers();

    const user = await (
      reader as BetterAuthSessionReader & {
        getSessionForPage(request: Request, responseHeaders: Headers): Promise<unknown>;
      }
    ).getSessionForPage(
      new Request("https://nanobook.test/n/manual"),
      responseHeaders,
    );

    expect(user).toEqual({ id: "user-1", name: "Ada Lovelace", email: "ada@example.com" });
    expect(responseHeaders.get("Set-Cookie")).toContain("better-auth.session_data=renewed");
  });
});
