import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const consumers = [
  "src/pages/[...slug]/index.astro",
  "src/browser/edition/ui/pages/PreviewPage.astro",
  "src/browser/edition/ui/pages/NewPage.astro",
  "src/browser/edition/ui/components/EditorToolbar.astro",
  "src/browser/edition/ui/components/DocumentEditor.astro",
] as const;

describe("browser application consumers", () => {
  it.each(consumers)("uses getApp for %s", (path) => {
    const source = read(path);

    expect(source).toContain("getApp");
    expect(source).toContain("app.editionModule");
    expect(source).not.toContain("import { edition");
  });
});
