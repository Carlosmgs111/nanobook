import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const consumers = [
  "src/documents/browser/ui/pages/DocumentPageController.astro",
  "src/documents/browser/ui/pages/PreviewPageController.astro",
  "src/documents/browser/ui/pages/NewDocumentPageController.astro",
  "src/documents/browser/ui/components/EditorToolbarController.astro",
  "src/documents/browser/ui/components/EditorController.astro",
] as const;

describe("browser application consumers", () => {
  it.each(consumers)("uses getApp for %s", (path) => {
    const source = read(path);

    expect(source).toContain("getApp");
    expect(source).toContain("app.editionModule");
    expect(source).not.toContain("import { edition");
  });

  it("composes Worker markdown extensions through the shared rendering factory", () => {
    const source = read(
      "src/documents/browser/infraestructure/renderer/WorkerMarkdownRenderer/worker-entry.ts",
    );

    expect(source).toContain("FinancialContentModule.create(blocks)");
    expect(source).toContain("createMarkdownEngine([createComponentBlocksExtension(blocks)])");
  });
});
