import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpAuthApi } from "./HttpAuthApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpAuthApi social sign-in", () => {
  it("accepts Better Auth's authorization URL when the client handles the redirect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            redirect: false,
            url: "https://github.com/login/oauth/authorize?state=signed",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(new HttpAuthApi().signInWithGitHub()).resolves.toEqual({
      authorizationUrl: "https://github.com/login/oauth/authorize?state=signed",
    });
  });
});
