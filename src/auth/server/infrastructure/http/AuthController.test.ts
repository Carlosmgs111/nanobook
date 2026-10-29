import { describe, expect, it } from "vitest";

import { createAuthController } from "./AuthController";

describe("createAuthController", () => {
  it("delegates the request to the configured Better Auth handler", async () => {
    const request = new Request("https://nanobook.test/api/auth/get-session");
    const expected = new Response("session", { status: 200 });
    const controller = createAuthController({
      handler: async (received) => {
        expect(received).toBe(request);
        return expected;
      },
    });

    const response = await controller({ request } as never);

    expect(response).toBe(expected);
  });

  it("turns an OAuth redirect instruction into a browser navigation", async () => {
    const request = new Request("https://nanobook.test/api/auth/oauth2/authorize", {
      headers: { "Sec-Fetch-Mode": "navigate" },
    });
    const controller = createAuthController({
      handler: () => new Response(
        JSON.stringify({ redirect: true, url: "/consent?client_id=codex" }),
        { headers: { "Content-Type": "application/json" } },
      ),
    });

    const response = await controller({ request } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://nanobook.test/consent?client_id=codex",
    );
  });
});
