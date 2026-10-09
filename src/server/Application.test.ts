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

vi.mock("./auth", () => ({
  AuthServerModule: { create },
}));

describe("Application", () => {
  it("composes profiles without retaining the legacy user module", async () => {
    const app = await Application.create();

    expect(app.profileModule).toBeDefined();
    expect("userModule" in app).toBe(false);
    expect(app.documentModule).toBeDefined();
    expect(app.navigationModule).toBeDefined();
    expect(app.publishingModule).toBeDefined();
  });

  it("exposes document mutation routes already protected by auth", async () => {
    const app = await Application.create();

    expect(app.documentModule.mutationRoutes).toEqual({
      POST: app.documentModule.createDocumentController.handle,
      PATCH: app.documentModule.updateDocumentController.handle,
      DELETE: app.documentModule.deleteDocumentController.handle,
    });
    expect(protect).toHaveBeenCalledWith(
      app.documentModule.createDocumentController.handle,
    );
    expect(protect).toHaveBeenCalledWith(
      app.documentModule.updateDocumentController.handle,
    );
    expect(protect).toHaveBeenCalledWith(
      app.documentModule.deleteDocumentController.handle,
    );
  });
});
