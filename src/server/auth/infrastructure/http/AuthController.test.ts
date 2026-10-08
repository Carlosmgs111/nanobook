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
});
