import { describe, expect, it, vi } from "vitest";
import { DocumentCreated, DocumentUpdated, DocumentDeleted } from "../../documents/server";
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
    CACHE_BACKEND: "memory",
    REDIS_URL: undefined,
    INVALIDATE_TOKEN: undefined,
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
    expect(app.nanobookModule.createNanobook).toBeDefined();
    expect(app.nanobookModule.createNanobookController).toBeDefined();
    expect(app.nanobookModule.listNanobooksController).toBeDefined();
    expect("documentModule" in app).toBe(false);
    expect(app.navigationModule).toBeDefined();
    expect(app.publishingModule.eventBus).toBe(app.nanobookModule.documentModule.eventBus);
    expect(app.themeModule).toBeDefined();
    expect(app.themeModule.assignNanobookThemeRoute).toBeDefined();
    expect("createNanobookController" in app).toBe(false);
    expect("navigationFor" in app.nanobookModule).toBe(false);
    expect("publishingFor" in app.nanobookModule).toBe(false);
    expect("createNanobookCapabilities" in app).toBe(false);
  });

  it("keeps nanobook persistence composition inside the nanobook module", async () => {
    const app = await Application.create();

    expect(app.nanobookModule).toBeDefined();
    expect("repository" in app.nanobookModule).toBe(false);
    expect(app.nanobookModule.getNanobookById).toBeDefined();
    expect(app.nanobookModule.getNanobookBySlug).toBeDefined();
    expect(app.nanobookModule.listNanobooks).toBeDefined();
  });
  it.each([DocumentCreated, DocumentUpdated, DocumentDeleted])(
    "invalidates published pages through the shared bus on %s",
    async (Event) => {
      const app = await Application.create();
      const cache = app.publishingModule.renderedPageCache;
      const refresh = vi.spyOn(app.nanobookModule.documentModule, "refreshDocuments").mockResolvedValue([]);
      await cache.set("doc-a", "hash", "old content");
      await cache.set("doc-b", "hash", "other book");
      app.publishingModule.registerEventHandlers();
      const invalidate = vi.spyOn(cache, "invalidate");
      const result = await app.nanobookModule.documentModule.eventBus.publish(new Event("doc-a", "book-a"));
      expect(result.isSuccess).toBe(true);
      expect(await cache.get("doc-a", "hash")).toBeNull();
      expect(await cache.get("doc-b", "hash")).not.toBeNull();
      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledExactlyOnceWith("book-a");
    },
  );

});
