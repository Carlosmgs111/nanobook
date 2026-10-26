import { describe, expect, it, vi } from "vitest";

const authController = vi.fn();
const getApp = vi.fn(async () => ({
  authServerModule: { authController },
}));

vi.mock("../../../application/server/Application", () => ({
  getApp,
}));

describe("OAuth authorization-server metadata route", () => {
  it("delegates issuer-path discovery to Better Auth", async () => {
    const route = await import("./[...issuer]");

    expect(getApp).toHaveBeenCalledOnce();
    expect(route.GET).toBe(authController);
  });
});
