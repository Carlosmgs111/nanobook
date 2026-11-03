import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpAuthSessionReader } from "./HttpAuthSessionReader";

const user = {
  id: "user-123",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpAuthSessionReader", () => {
  it("returns the authenticated user from Better Auth's cookie-backed session", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ session: { id: "session-123" }, user }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(new HttpAuthSessionReader().getCurrentUser()).resolves.toEqual(
      user,
    );
    expect(fetch).toHaveBeenCalledWith("/api/auth/get-session", {
      credentials: "include",
    });
  });

  it("returns null when Better Auth reports no active session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("null", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(new HttpAuthSessionReader().getCurrentUser()).resolves.toBeNull();
  });
});
