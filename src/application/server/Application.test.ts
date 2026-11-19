import { createMarkdownEngine } from "../../rendering/shared";
import { describe, expect, it, vi } from "vitest";
import { RENDERER_VERSION } from "../../rendering/shared";
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
    BETTER_AUTH_SECRET: undefined,
    EMAIL_FROM: undefined,
    RESEND_API_KEY: undefined,
  }),
  { virtual: true }
);

vi.mock("../../auth/server", () => ({
  AuthServerModule: { create },
}));

const financialDocument = {
  getContent: () => `\`\`\`financial-metrics
version: 1
metrics:
  - label: Margen ilustrativo
    value: 12
    unit: percent
    period: { label: "2024" }
    sourceIds: [example]
sources:
  - id: example
    label: Fuente de ejemplo
    url: https://example.com/metrics
    type: dataset
    period: { label: "2024" }
\`\`\``,
};

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
    expect(app.themeModule).toBeDefined();
    expect(app.themeModule.assignNanobookThemeRoute).toBeDefined();
    expect("createNanobookController" in app).toBe(false);
    expect("navigationFor" in app.nanobookModule).toBe(false);
    expect("publishingFor" in app.nanobookModule).toBe(false);
    expect("createNanobookCapabilities" in app).toBe(false);
  });

  it("composes the spreadsheets server module with the documents capabilities", async () => {
    const app = await Application.create();

    expect(app.spreadsheetsServerModule.saveSpreadsheetController.handle).toBeTypeOf("function");
  });

  it("keeps nanobook persistence composition inside the nanobook module", async () => {
    const app = await Application.create();

    expect(app.nanobookModule).toBeDefined();
    expect("repository" in app.nanobookModule).toBe(false);
    expect(app.nanobookModule.getNanobookBySlug).toBeDefined();
    expect(app.nanobookModule.listNanobooks).toBeDefined();
  });

  it("composes financial blocks as an internal rendering capability", async () => {
    const app = await Application.create();
    const { markdownEngine } = app.renderingModule;
    const published = await markdownEngine.render(financialDocument.getContent());

    expect(published).toContain("<!--nb:block-start financial-metrics ");
    expect(published).toContain("Margen ilustrativo");
    expect(markdownEngine.fingerprint).toBe(`${RENDERER_VERSION}|component-blocks@2`);
    expect(app).not.toHaveProperty("financialContentModule");
    expect(app).not.toHaveProperty("financialContentRepository");
    expect(app).not.toHaveProperty("financialBlockSchemas");
  }, 15_000);

  it("publishes a framework block that the page turns into an island", async () => {
    const app = await Application.create();
    const document = {
      getContent: () =>
        "Antes.\n\n```price-chart\ntitle: ACME\nseries:\n  type: line\n  data:\n    - { time: 2026-01-02, value: 10 }\n```\n\nDespués.",
    };

    const published = await app.renderingModule.markdownEngine.render(document.getContent());
    const pieces = app.renderingModule.pieceResolver.resolve(published);

    expect(pieces.map((piece) => piece.kind)).toEqual(["html", "island", "html"]);
    expect(pieces[1]).toMatchObject({ kind: "island", name: "price-chart", props: { title: "ACME", height: 360 } });
  }, 15_000);

  it("keeps financial fences as code when the engine has no extensions", async () => {
    const engine = createMarkdownEngine();
    const published = await engine.render(financialDocument.getContent());

    expect(published).toContain('<code class="language-financial-metrics">');
    expect(engine.fingerprint).toBe(RENDERER_VERSION);
  }, 15_000);
});
