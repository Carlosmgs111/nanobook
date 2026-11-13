import { describe, expect, it } from "vitest";
import { createMarkdownEngine } from "./createMarkdownEngine";
import type { MarkdownExtension } from "./MarkdownExtension";
import { RENDERER_VERSION } from "./rendererFingerprint";

const headingExtension: MarkdownExtension = {
  id: "section-heading",
  version: "3",
  transform(tree) {
    const heading = tree.children[0];
    if (heading?.type === "element" && heading.tagName === "h1") heading.tagName = "h2";
  },
};

describe("createMarkdownEngine", () => {
  it("renders headings with the shared pipeline and no extensions", async () => {
    const engine = createMarkdownEngine();

    expect(await engine.render("# Server")).toBe('<h1 id="server">Server</h1>');
    expect(engine.fingerprint).toBe(RENDERER_VERSION);
  }, 15_000);

  it("applies and fingerprints the configured extensions", async () => {
    const engine = createMarkdownEngine([headingExtension]);

    expect(await engine.render("# Server")).toBe('<h2 id="server">Server</h2>');
    expect(engine.fingerprint).toBe(`${RENDERER_VERSION}|section-heading@3`);
  });

  it("keeps the original empty configuration after the caller adds an extension", async () => {
    const extensions: MarkdownExtension[] = [];
    const engine = createMarkdownEngine(extensions);
    extensions.push(headingExtension);

    expect(engine.fingerprint).toBe(RENDERER_VERSION);
    expect(await engine.render("# Server")).toBe('<h1 id="server">Server</h1>');
  });

  it("keeps configured extensions after the caller removes or replaces entries", async () => {
    const extensions = [headingExtension];
    const engine = createMarkdownEngine(extensions);
    extensions[0] = { id: "other", version: "1", transform() {} };

    expect(engine.fingerprint).toBe(`${RENDERER_VERSION}|section-heading@3`);
    expect(await engine.render("# Server")).toBe('<h2 id="server">Server</h2>');
  });
});
