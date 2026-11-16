import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { Application } from "../../../application/server/Application";
import { UnifiedMarkdownRenderer as PreviewRenderer } from "../../../documents/browser/infraestructure/renderer/UnifiedMarkdownRenderer";

vi.mock("astro:env/server", () => ({
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
}), { virtual: true });

vi.mock("../../../auth/server", () => ({
  AuthServerModule: { create: () => ({ protect: (handler: unknown) => handler }) },
}));

const note = readFileSync(new URL("./fixtures/alphabet-analysis.md", import.meta.url), "utf8");

it("publishes the full financial note as framework blocks in author order, with identical SSR and preview HTML", async () => {
  const app = await Application.create();
  const published = await app.renderingModule.markdownEngine.render(note);
  const preview = await new PreviewRenderer(app.renderingModule.markdownEngine).render(note);

  const pieces = app.renderingModule.pieceResolver.resolve(published);
  const blocks = pieces.flatMap((piece) => (piece.kind === "island" ? [piece.name] : []));
  expect(blocks).toEqual(["company-profile", "financial-metrics", "financial-chart", "financial-news", "financial-sources"]);
  expect(published).not.toContain("component-block-error");
  expect(note).not.toMatch(/(?:comprar|vender)/i);
  expect(preview.isSuccess).toBe(true);
  expect(preview.getValue().Content).toBe(published);
}, 15_000);
