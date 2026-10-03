import { describe, expect, it } from "vitest";

import { AuthApiError, HttpAuthApi } from "./HttpAuthApi";

const authenticatedUser = {
  id: "user-123",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

describe("HttpAuthApi", () => {
  it("signs in with Better Auth's email endpoint and returns its user", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const api = new HttpAuthApi(async (input, init) => {
      requests.push({ input, init });
      return new Response(
        JSON.stringify({ token: "session-token", redirect: false, user: authenticatedUser }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    await expect(
      api.signIn({ email: "ada@example.com", password: "password123" })
    ).resolves.toEqual(authenticatedUser);

    expect(requests).toEqual([
      {
        input: "/api/auth/sign-in/email",
        init: {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ email: "ada@example.com", password: "password123" }),
        },
      },
    ]);
  });

  it("registers with Better Auth's email endpoint and includes the name", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const api = new HttpAuthApi(async (input, init) => {
      requests.push({ input, init });
      return new Response(
        JSON.stringify({ token: "session-token", user: authenticatedUser }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    await expect(
      api.signUp({
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "password123",
      })
    ).resolves.toEqual(authenticatedUser);

    expect(requests[0]).toMatchObject({
      input: "/api/auth/sign-up/email",
      init: {
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          password: "password123",
        }),
      },
    });
  });

  it("exposes Better Auth's error message to the caller", async () => {
    const api = new HttpAuthApi(async () =>
      new Response(JSON.stringify({ message: "Credenciales inválidas" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      api.signIn({ email: "ada@example.com", password: "incorrecta" })
    ).rejects.toEqual(new AuthApiError("Credenciales inválidas", 401));
  });

  it("returns Better Auth's GitHub authorization URL without following it", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const api = new HttpAuthApi(async (input, init) => {
      requests.push({ input, init });
      return new Response(
        JSON.stringify({
          redirect: true,
          url: "https://github.com/login/oauth/authorize?state=signed",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await expect(api.signInWithGitHub()).resolves.toEqual({
      authorizationUrl: "https://github.com/login/oauth/authorize?state=signed",
    });

    expect(requests).toEqual([
      {
        input: "/api/auth/sign-in/social",
        init: {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            provider: "github",
            callbackURL: "/",
            disableRedirect: true,
          }),
        },
      },
    ]);
  });

  it("rejects a successful social response without an authorization URL", async () => {
    const api = new HttpAuthApi(async () =>
      new Response(JSON.stringify({ redirect: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(api.signInWithGitHub()).rejects.toEqual(
      new AuthApiError("Respuesta de autenticación inválida.", 200),
    );
  });
});
