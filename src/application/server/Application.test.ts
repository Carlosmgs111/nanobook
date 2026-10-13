import { describe, expect, it, vi } from "vitest";
import { Application } from "./Application";

const { protect, create } = vi.hoisted(() => {
  const protect = vi.fn((handler) => handler);
  return {
    protect,
    create: vi.fn(() => ({ protect })),
  };
});

vi.mock(
  "astro:env/server",
  () => ({
    GITHUB_TOKEN: undefined,
    CONTENT_SOURCE: "memory",
    CACHE_BACKEND: "memory",
    REDIS_URL: undefined,
    INVALIDATE_TOKEN: undefined,
    GITHUB_WEBHOOK_SECRET: undefined,
    GITHUB_BRANCH: undefined,
    GITHUB_PATH: undefined,
    GITHUB_OWNER: undefined,
    GITHUB_REPO: undefined,
    GITHUB_OAUTH_CLIENT_ID: undefined,
    GITHUB_OAUTH_CLIENT_SECRET: undefined,
    BETTER_AUTH_URL: undefined,
    EMAIL_FROM: undefined,
    RESEND_API_KEY: undefined,
  }),
  { virtual: true }
);

vi.mock("../../auth/server", () => ({
  AuthServerModule: { create },
}));

describe("Application", () => {
  it("composes profiles without retaining the legacy user module", async () => {
    const app = await Application.create();

    expect(app.routeProtector).toBe(app.authServerModule);
    expect(app.profileModule).toBeDefined();
    expect("userModule" in app).toBe(false);
    expect(app.nanobookModule).toBeDefined();
    expect(app.createNanobookController).toBeDefined();
    expect(app.nanobookModule.createNanobook).toBeDefined();
    expect(app.nanobookModule.listNanobooksController).toBeDefined();
    expect("documentModule" in app).toBe(false);
    expect("navigationModule" in app).toBe(false);
    expect("publishingModule" in app).toBe(false);
  });

  it("keeps collection composition inside the nanobook module", async () => {
    const app = await Application.create();

    expect(app.nanobookModule).toBeDefined();
    expect(app.nanobookModule.repository).toBeDefined();
  });
});
