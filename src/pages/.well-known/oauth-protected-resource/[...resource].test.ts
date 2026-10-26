import { describe, expect, it, vi } from "vitest";

const authController = vi.fn();
const getApp = vi.fn(async () => ({
  authServerModule: { authController },
}));

vi.mock("../../../application/server/Application", () => ({
  getApp,
}));

describe("OAuth protected-resource metadata route", () => {
  it("delegates the MCP discovery request to Better Auth", async () => {
    const route = await import("./[...resource]");

    expect(getApp).toHaveBeenCalledOnce();
    expect(route.GET).toBe(authController);
  });
});
