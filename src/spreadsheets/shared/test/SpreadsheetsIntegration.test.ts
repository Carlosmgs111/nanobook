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

const document = readFileSync(new URL("./fixtures/ventas-por-region.md", import.meta.url), "utf8");

it("publishes a document that uses the spreadsheets module, in author order", async () => {
  const app = await Application.create();
  const published = await app.renderingModule.markdownEngine.render(document);

  const pieces = app.renderingModule.pieceResolver.resolve(published);
  const blocks = pieces.flatMap((piece) => (piece.kind === "island" ? [piece.name] : []));

  expect(blocks).toEqual(["spreadsheet", "spreadsheet-totals", "spreadsheet"]);
  expect(published).not.toContain("component-block-error");
  const [editable, , readOnly] = pieces.filter((piece) => piece.kind === "island");
  expect(editable).toMatchObject({ props: { readOnly: false } });
  expect(readOnly).toMatchObject({ props: { readOnly: true } });
}, 15_000);

it("produces the same HTML in the preview Worker as in publication", async () => {
  const app = await Application.create();
  const published = await app.renderingModule.markdownEngine.render(document);
  const preview = await new PreviewRenderer(app.renderingModule.markdownEngine).render(document);

  expect(preview.getValue().Content).toBe(published);
}, 15_000);

const cases = readFileSync(new URL("./fixtures/hojas-casos.md", import.meta.url), "utf8");

it("renders the cases fixture: valid blocks, inline errors, near-miss fences and nested fallbacks", async () => {
  const app = await Application.create();
  const published = await app.renderingModule.markdownEngine.render(cases);
  const pieces = app.renderingModule.pieceResolver.resolve(published);
  const blocks = pieces.flatMap((piece) => (piece.kind === "island" ? [piece] : []));

  expect(blocks.map((piece) => piece.name)).toEqual([
    "spreadsheet", // 1
    "spreadsheet", // 2
    "spreadsheet", // 3
    "spreadsheet", // 4
    "spreadsheet-totals", // 5
    "spreadsheet-totals", // 6
  ]);
  expect(blocks[1]).toMatchObject({ props: { readOnly: false } });
  expect(blocks[5]).toMatchObject({ props: { functions: ["sum"] } });
  expect(published.match(/component-block-error/g)).toHaveLength(3);
  expect(published).toContain("language-spreadsheet-total"); // errata: queda como código
  expect(published.match(/data-component="spreadsheet"/g)).toHaveLength(5); // 4 de raíz + 1 anidado como respaldo
  expect(published).toContain("Fin del documento");
}, 15_000);
