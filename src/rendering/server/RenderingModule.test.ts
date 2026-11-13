import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RenderingModule } from "./index";

const counter = {
  name: "counter-demo",
  component: "/src/demo/Counter.astro",
  props: z.object({ label: z.string().default("Contador"), start: z.number().int().default(0) }),
};

describe("RenderingModule", () => {
  it("renders and resolves blocks that modules register after it was created", async () => {
    const rendering = RenderingModule.create();
    const fence = "Antes\n\n```counter-demo\nstart: 2\n```\n\nDespués";

    expect(await rendering.markdownEngine.render(fence)).not.toContain("data-component");

    rendering.blocks.register([counter]);
    const html = await rendering.markdownEngine.render(fence);

    expect(rendering.pieceResolver.resolve(html).map((piece) => piece.kind)).toEqual(["html", "island", "html"]);
    expect(rendering.pieceResolver.resolve(html)[1]).toMatchObject({
      name: "counter-demo",
      component: "/src/demo/Counter.astro",
      props: { label: "Contador", start: 2 },
    });
  }, 15_000);

  it("rejects an invalid or duplicated registration without registering any of it", () => {
    const { blocks } = RenderingModule.create();

    expect(() => blocks.register([counter, counter])).toThrow(/duplicado/i);
    expect(blocks.blocks).toEqual([]);
    expect(() => blocks.register([{ ...counter, name: "Demo" }])).toThrow(/inválido/i);
    expect(() => blocks.register([{ ...counter, component: "Demo.tsx" }])).toThrow(/\.astro/);
  });
});
