import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { createMarkdownExtensions } from "../../../application/shared/createMarkdownExtensions";
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

it("renders the full financial note in author order with identical SSR and preview HTML", async () => {
  const app = await Application.create();
  const { Content: published } = await app.publishingModule.pageRenderer.render({ getContent: () => note });
  const preview = await new PreviewRenderer(createMarkdownExtensions()).render(note);

  const blockClasses = Array.from(published.matchAll(/class="financial-block ([^"]+)"/g), ([, name]) => name);
  expect(blockClasses).toEqual([
    "financial-company",
    "financial-metrics",
    "financial-chart",
    "financial-news",
    "financial-sources",
  ]);
  expect(published).not.toMatch(/<code class="language-(?:company-profile|financial-[^"]+)">/);
  expect(published).not.toContain("financial-block--error");
  expect(published).toContain("Las cifras y la noticia son simuladas");
  expect(note).not.toMatch(/\b(?:comprar|vender)\b/i);
  expect(published).toContain('<a href="https://example.com/alphabet/datos-simulados"');
  expect(published).toContain("Ejercicio simulado 2024");
  expect(published).toContain("Serie simulada 2022–2024");
  expect(published).toContain('<svg class="financial-chart__plot"');
  expect(published).toContain('<table aria-labelledby="financial:chart-2-heading">');
  expect(published).toContain('<th scope="row">2024</th>');
  expect(preview.isSuccess).toBe(true);
  expect(preview.getValue().Content).toBe(published);
}, 15_000);
