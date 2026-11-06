import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const consumers = [
  "src/documents/browser/ui/DocumentPageController.astro",
  "src/documents/browser/ui/PreviewPageController.astro",
  "src/documents/browser/ui/NewDocumentPageController.astro",
  "src/documents/browser/ui/EditorToolbarController.astro",
  "src/documents/browser/ui/EditorController.astro",
] as const;

describe("browser application consumers", () => {
  it.each(consumers)("uses getApp for %s", (path) => {
    const source = read(path);

    expect(source).toContain("getApp");
    expect(source).toContain("app.editionModule");
    expect(source).not.toContain("import { edition");
  });

  it("composes Worker markdown extensions through the shared application factory", () => {
    const source = read(
      "src/documents/browser/infraestructure/renderer/WorkerMarkdownRenderer/worker-entry.ts",
    );

    expect(source).toMatch(/import\s*\{\s*createMarkdownExtensions\s*\}\s*from\s*["'][^"']*\/application\/shared\/createMarkdownExtensions["']/);
    expect(source).toContain("new UnifiedMarkdownRenderer(createMarkdownExtensions())");
    expect(source).not.toContain("financial-content");
  });
});
