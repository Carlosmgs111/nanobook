import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthApiError, HttpAuthApi } from "./HttpAuthApi";

const authenticatedUser = {
  id: "user-123",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpAuthApi", () => {
  it("signs in with Better Auth's email endpoint and returns the authenticated user", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(
        JSON.stringify({ token: "session-token", redirect: false, user: authenticatedUser }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const api = new HttpAuthApi();

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

  it("forwards the signed OAuth query and returns its redirect after sign-in", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.stubGlobal("window", {
      location: {
        search: "?client_id=codex&scope=nanobooks%3Aread&ba_param=client_id&ba_param=scope&sig=signed",
      },
    });
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(
        JSON.stringify({ redirect: true, url: "http://127.0.0.1:60522/callback?code=issued" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const api = new HttpAuthApi();

    await expect(
      api.signIn({ email: "ada@example.com", password: "password123" }),
    ).resolves.toEqual({ redirectUrl: "http://127.0.0.1:60522/callback?code=issued" });

    expect(requests[0]).toMatchObject({
      input: "/api/auth/sign-in/email",
      init: {
        body: JSON.stringify({
          email: "ada@example.com",
          password: "password123",
          oauth_query: "client_id=codex&scope=nanobooks%3Aread&ba_param=client_id&ba_param=scope&sig=signed",
        }),
      },
    });
  });

  it("registers with Better Auth's email endpoint and includes the name", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(
        JSON.stringify({ token: "session-token", user: authenticatedUser }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    const api = new HttpAuthApi();

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
          callbackURL: "/",
        }),
      },
    });
  });

  it("forwards the signed OAuth query when registering from an authorization flow", async () => {
    vi.stubGlobal("window", {
      location: {
        search: "?client_id=codex&ba_param=client_id&sig=signed",
      },
    });
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ token: "session-token", user: authenticatedUser }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = new HttpAuthApi();

    await api.signUp({ name: "Ada Lovelace", email: "ada@example.com", password: "password123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/sign-up/email",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Ada Lovelace",
          email: "ada@example.com",
          password: "password123",
          callbackURL: "/",
          oauth_query: "client_id=codex&ba_param=client_id&sig=signed",
        }),
      }),
    );
  });

  it("ends the current Better Auth session", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const api = new HttpAuthApi();

    await expect(api.signOut()).resolves.toBeUndefined();

    expect(requests).toEqual([
      {
        input: "/api/auth/sign-out",
        init: {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({}),
        },
      },
    ]);
  });

  it("exposes Better Auth's error message to the caller", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ message: "Credenciales inválidas" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    const api = new HttpAuthApi();

    await expect(
      api.signIn({ email: "ada@example.com", password: "incorrecta" })
    ).rejects.toEqual(new AuthApiError("Credenciales inválidas", 401));
  });

  it("returns Better Auth's GitHub authorization URL when the client handles the redirect", async () => {
    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    vi.stubGlobal("window", {
      location: {
        search: "?client_id=codex&ba_param=client_id&sig=signed",
      },
    });
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ input, init });
      return new Response(
        JSON.stringify({
          redirect: false,
          url: "https://github.com/login/oauth/authorize?state=signed",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    const api = new HttpAuthApi();

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
          callbackURL: "/api/auth/oauth2/authorize?client_id=codex&ba_param=client_id&sig=signed",
            disableRedirect: true,
          oauth_query: "client_id=codex&ba_param=client_id&sig=signed",
          }),
        },
      },
    ]);
  });

  it("rejects a successful social response without an authorization URL", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ redirect: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const api = new HttpAuthApi();

    await expect(api.signInWithGitHub()).rejects.toEqual(
      new AuthApiError("Respuesta de autenticación inválida.", 200),
    );
  });
});
