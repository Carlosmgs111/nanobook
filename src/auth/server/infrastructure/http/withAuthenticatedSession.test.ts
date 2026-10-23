import { describe, expect, it, vi } from "vitest";

import { BetterAuthSessionReader } from "../better-auth/BetterAuthSessionReader";
import { withAuthenticatedSession } from "./withAuthenticatedSession";

describe("withAuthenticatedSession", () => {
  it("terminates the request with 401 when there is no session", async () => {
    const handler = vi.fn();
    const route = withAuthenticatedSession(
      new BetterAuthSessionReader({
        api: { getSession: async () => null },
      }),
      handler,
    );

    const response = await route({
      request: new Request("https://nanobook.test/api/me/documents/guide"),
      locals: {},
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Autenticación requerida",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("continues the wrapped capability and exposes the authenticated user", async () => {
    const handler = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const route = withAuthenticatedSession(
      new BetterAuthSessionReader({
        api: {
          getSession: async () => ({
            user: {
              id: "user-1",
              name: "Ada Lovelace",
              email: "ada@example.com",
            },
          }),
        },
      }),
      handler,
    );
    const context = {
      request: new Request("https://nanobook.test/api/me/documents/guide"),
      locals: {},
    };

    const response = await route(context as never);

    expect(response.status).toBe(204);
    expect(context.locals).toMatchObject({
      currentUserId: "user-1",
      currentUser: {
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      },
    });
    expect(handler).toHaveBeenCalledWith(context);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects cross-origin and originless authenticated mutations", async () => {
    const handler = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const route = withAuthenticatedSession(
      new BetterAuthSessionReader({
        api: { getSession: async () => ({ user: { id: "user-1", name: "Ada", email: "ada@example.com" } }) },
      }),
      handler,
    );

    for (const headers of [{ Origin: "https://other.test" }, {}]) {
      const response = await route({
        request: new Request("https://nanobook.test/api/me/profile", { method: "PATCH", headers }),
        locals: {},
      } as never);
      expect(response.status).toBe(403);
    }
    expect(handler).not.toHaveBeenCalled();

    const response = await route({
      request: new Request("https://nanobook.test/api/me/profile", {
        method: "PATCH",
        headers: { Origin: "https://nanobook.test" },
      }),
      locals: {},
    } as never);
    expect(response.status).toBe(204);
  });

  it("adds private cache headers to immutable redirect responses", async () => {
    const route = withAuthenticatedSession(
      new BetterAuthSessionReader({
        api: { getSession: async () => ({ user: { id: "user-1", name: "Ada", email: "ada@example.com" } }) },
      }),
      async () => Response.redirect("https://nanobook.test/nanobooks"),
    );
    const response = await route({
      request: new Request("https://nanobook.test/api/me/profile"),
      locals: {},
    } as never);
    expect(response.status).toBe(302);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
