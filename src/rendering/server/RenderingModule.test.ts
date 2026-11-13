import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RenderingModule } from "./index";

const rendering = RenderingModule.create([
  {
    name: "counter-demo",
    component: "/src/demo/Counter.astro",
    props: z.object({ label: z.string().default("Contador"), start: z.number().int().default(0) }),
  },
]);

describe("RenderingModule", () => {
  it("wires the engine, the registry and the piece resolver around the same blocks", async () => {
    const html = await rendering.markdownEngine.render("Antes\n\n```counter-demo\nstart: 2\n```\n\nDespués");

    expect(rendering.blocks.find("counter-demo")).toBeDefined();
    expect(rendering.pieceResolver.resolve(html).map((piece) => piece.kind)).toEqual(["html", "island", "html"]);
    expect(rendering.pieceResolver.resolve(html)[1]).toMatchObject({
      name: "counter-demo",
      component: "/src/demo/Counter.astro",
      props: { label: "Contador", start: 2 },
    });
  }, 15_000);

  it("rejects an invalid or duplicated registration", () => {
    const block = { name: "demo", component: "/src/demo/Demo.astro", props: z.object({}) };

    expect(() => RenderingModule.create([block, block])).toThrow(/duplicado/i);
    expect(() => RenderingModule.create([{ ...block, name: "Demo" }])).toThrow(/inválido/i);
    expect(() => RenderingModule.create([{ ...block, component: "Demo.tsx" }])).toThrow(/\.astro/);
  });
});
