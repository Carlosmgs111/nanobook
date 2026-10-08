import { describe, expect, it, vi } from "vitest";

const authController = vi.fn();
const create = vi.fn(() => ({ authController }));

vi.mock("../../../auth/server", () => ({
  AuthServerModule: { create },
}));

describe("Better Auth API route", () => {
  it("uses the server module factory to expose its controller", async () => {
    const route = await import("./[...all]");

    expect(create).toHaveBeenCalledOnce();
    expect(route.ALL).toBe(authController);
  });
});
