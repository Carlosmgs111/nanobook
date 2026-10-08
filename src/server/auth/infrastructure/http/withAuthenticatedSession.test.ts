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
      request: new Request("https://nanobook.test/api/documents/guide"),
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
      request: new Request("https://nanobook.test/api/documents/guide"),
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
  });
});
