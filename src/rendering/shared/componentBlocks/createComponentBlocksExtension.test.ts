import { describe, expect, it } from "vitest";
import { z } from "zod";
import { renderMarkdown } from "../renderMarkdown";
import type { ComponentBlockDefinition } from "./ComponentBlockDefinition";
import { createComponentBlocksExtension } from "./createComponentBlocksExtension";

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
  });
});
