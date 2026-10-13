import { describe, expect, it, vi } from "vitest";

const authController = vi.fn();
const getApp = vi.fn(async () => ({
  authServerModule: { authController },
}));

vi.mock("../../../application/server/Application", () => ({
  getApp,
}));

describe("Better Auth API route", () => {
  it("uses the composed application to expose its controller", async () => {
    const route = await import("./[...all]");

    expect(getApp).toHaveBeenCalledOnce();
    expect(route.ALL).toBe(authController);
  });
});
