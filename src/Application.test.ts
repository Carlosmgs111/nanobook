import { describe, expect, it, vi } from "vitest";
import { Application } from "./Application";

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
  }),
  { virtual: true }
);

describe("Application", () => {
  it("exposes the composed user module alongside existing modules", async () => {
    const app = await Application.create();

    expect(app.userModule).toBeDefined();
    expect(app.documentModule).toBeDefined();
    expect(app.navigationModule).toBeDefined();
    expect(app.publishingModule).toBeDefined();
  });
});
