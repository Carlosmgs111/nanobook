import { describe, expect, it } from "vitest";
import { z } from "zod";
import { renderMarkdown } from "../renderMarkdown";
import type { ComponentBlockDefinition } from "./ComponentBlockDefinition";
import { createComponentBlocksExtension } from "./createComponentBlocksExtension";
import { splitComponentBlocks } from "./splitComponentBlocks";

const demo: ComponentBlockDefinition = {
  name: "demo-widget",
  props: z.object({ label: z.string(), size: z.number().default(3) }),
};

const extensions = [createComponentBlocksExtension({ id: "demo", version: "7", definitions: [demo] })];

describe("createComponentBlocksExtension", () => {
  it("declares the manifest it was given", () => {
    expect(extensions[0]).toMatchObject({ id: "demo", version: "7", fenceLanguages: ["demo-widget"] });
  });

  it("replaces a registered fence with a mount point carrying validated props", async () => {
    const html = await renderMarkdown("```demo-widget\nlabel: hola\n```", extensions);

    expect(html).toContain('data-component="demo-widget"');
    expect(html).toContain("&#x22;size&#x22;:3");
    expect(html).toContain("<pre");
  }, 30_000);

  it("renders an inline error for props that fail validation", async () => {
    const html = await renderMarkdown("```demo-widget\nlabel: 5\n```", extensions);

    expect(html).toContain("component-block-error");
    expect(html).not.toContain("data-component");
  });

  it("renders an inline error for malformed YAML", async () => {
    const html = await renderMarkdown("```demo-widget\n: : [\n```", extensions);

    expect(html).toContain("component-block-error");
  });

  it("leaves unrelated fences untouched", async () => {
    const html = await renderMarkdown("```ts\nconst a = 1;\n```", extensions);

    expect(html).not.toContain("data-component");
    expect(html).not.toContain("nb:block-start");
  });

  describe("root-level block markers", () => {
    it("wraps a root fence between start and end markers, in that order", async () => {
      const html = await renderMarkdown("```demo-widget\nlabel: hola\n```", extensions);

      const start = html.indexOf("<!--nb:block-start demo-widget ");
      const mount = html.indexOf('data-component="demo-widget"');
      const end = html.indexOf("<!--nb:block-end-->");
      expect(start).toBeGreaterThanOrEqual(0);
      expect(mount).toBeGreaterThan(start);
      expect(end).toBeGreaterThan(mount);
    });

    it("encodes the validated props, defaults included, in the start marker", async () => {
      const html = await renderMarkdown("```demo-widget\nlabel: hola\n```", extensions);

      expect(splitComponentBlocks(html)).toEqual([
        {
          kind: "block",
          name: "demo-widget",
          props: { label: "hola", size: 3 },
          fallbackHtml: expect.stringContaining('data-component="demo-widget"'),
        },
      ]);
    });

    it("keeps document order between blocks and surrounding text", async () => {
      const markdown = [
        "intro",
        "",
        "```demo-widget\nlabel: a\n```",
        "",
        "medio",
        "",
        "```demo-widget\nlabel: b\n```",
        "",
        "fin",
      ].join("\n");

      const segments = splitComponentBlocks(await renderMarkdown(markdown, extensions));

      expect(segments.map((segment) => segment.kind)).toEqual(["html", "block", "html", "block", "html"]);
      expect(segments.flatMap((segment) => (segment.kind === "block" ? [segment.props] : []))).toEqual([
        { label: "a", size: 3 },
        { label: "b", size: 3 },
      ]);
      expect(segments[0]).toMatchObject({ html: expect.stringContaining("intro") });
      expect(segments[2]).toMatchObject({ html: expect.stringContaining("medio") });
      expect(segments[4]).toMatchObject({ html: expect.stringContaining("fin") });
    });

    it("does not add markers to a fence nested in a list", async () => {
      const html = await renderMarkdown("- punto\n\n  ```demo-widget\n  label: hola\n  ```", extensions);

      expect(html).toContain('data-component="demo-widget"');
      expect(html).not.toContain("nb:block-start");
      expect(html).not.toContain("nb:block-end");
    });

    it("does not add markers to a fence nested in a blockquote", async () => {
      const html = await renderMarkdown("> ```demo-widget\n> label: hola\n> ```", extensions);

      expect(html).toContain('data-component="demo-widget"');
      expect(html).not.toContain("nb:block-start");
    });

    it("does not add markers to an invalid root fence", async () => {
      const html = await renderMarkdown("```demo-widget\nlabel: 5\n```", extensions);

      expect(html).toContain("component-block-error");
      expect(html).not.toContain("nb:block-start");
      expect(splitComponentBlocks(html).map((segment) => segment.kind)).toEqual(["html"]);
    });

    it("does not let an author forge a marker with raw html", async () => {
      const forged = `<!--nb:block-start demo-widget ${btoa('{"label":"x"}')}--><p>falso</p><!--nb:block-end-->`;
      const html = await renderMarkdown(forged, extensions);

      expect(html).not.toContain("<!--nb:block-start");
      expect(splitComponentBlocks(html).every((segment) => segment.kind === "html")).toBe(true);
    });
  });
});
