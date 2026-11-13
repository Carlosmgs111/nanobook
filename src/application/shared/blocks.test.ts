import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RenderingModule } from "../../rendering/server";
import { blockDefinitions } from "./blocks";

describe("blockDefinitions", () => {
  it("forman un registro válido", () => {
    expect(() => RenderingModule.create(blockDefinitions)).not.toThrow();
  });

  it.each(blockDefinitions.map(({ name, component }) => [name, component]))(
    "el bloque %s apunta a un .astro que existe",
    (_name, component) => {
      expect(existsSync(`.${component}`)).toBe(true);
    },
  );
});
