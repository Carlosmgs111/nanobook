import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { BLOCK_NAME_PATTERN } from "../../rendering/shared/componentBlocks/blockMarker";
import type { ComponentBlockDefinition } from "../../rendering/shared/componentBlocks/ComponentBlockDefinition";
import {
  collectFrameworkBlockDefinitions,
  findFrameworkBlockDefinition,
  listFrameworkBlockDefinitions,
} from "./componentBlockDefinitions";

const definition = (name: string): ComponentBlockDefinition => ({ name, props: z.object({}) });

describe("collectFrameworkBlockDefinitions", () => {
  it("returns no definitions for no modules", () => {
    expect(collectFrameworkBlockDefinitions({})).toEqual([]);
  });

  it("returns the default export of each module, ordered by module path", () => {
    const collected = collectFrameworkBlockDefinitions({
      "/src/b/browser/components/Beta.block.ts": { default: definition("beta-block") },
      "/src/a/browser/components/Alpha.block.ts": { default: definition("alpha-block") },
    });

    expect(collected.map(({ name }) => name)).toEqual(["alpha-block", "beta-block"]);
  });

  it("fails naming the module that has no default export", () => {
    expect(() =>
      collectFrameworkBlockDefinitions({ "/src/a/browser/components/Alpha.block.ts": {} }),
    ).toThrow("/src/a/browser/components/Alpha.block.ts");
  });

  it("fails naming the module whose block name is not allowed", () => {
    expect(() =>
      collectFrameworkBlockDefinitions({
        "/src/a/browser/components/Alpha.block.ts": { default: definition("Alpha Block") },
      }),
    ).toThrow(/Alpha\.block\.ts.*Alpha Block/s);
  });

  it("fails naming both modules when two blocks share a name", () => {
    expect(() =>
      collectFrameworkBlockDefinitions({
        "/src/a/browser/components/One.block.ts": { default: definition("same-name") },
        "/src/b/browser/components/Two.block.ts": { default: definition("same-name") },
      }),
    ).toThrow(/same-name.*One\.block\.ts.*Two\.block\.ts/s);
  });
});

describe("the registered framework block definitions", () => {
  it("have unique names that follow the allowed pattern", () => {
    const names = listFrameworkBlockDefinitions().map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(BLOCK_NAME_PATTERN);
  });

  it("can be found by name", () => {
    for (const { name } of listFrameworkBlockDefinitions()) {
      expect(findFrameworkBlockDefinition(name)?.name).toBe(name);
    }
    expect(findFrameworkBlockDefinition("does-not-exist")).toBeUndefined();
  });
});

/** Importaciones que un `*.block.ts` puede tener: el servidor y el Worker lo cargan. */
function forbiddenImports(source: string): string[] {
  const specifiers = [...source.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  return specifiers.filter(
    (specifier) => specifier !== "zod" && !specifier.endsWith("rendering/shared/componentBlocks/ComponentBlockDefinition"),
  );
}

describe("forbiddenImports", () => {
  it("accepts zod and the contract type", () => {
    const source = [
      'import { z } from "zod";',
      'import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";',
    ].join("\n");

    expect(forbiddenImports(source)).toEqual([]);
  });

  it("flags framework and node imports", () => {
    const source = ['import { useState } from "react";', 'import fs from "node:fs";'].join("\n");

    expect(forbiddenImports(source)).toEqual(["react", "node:fs"]);
  });
});

describe("*.block.ts files in the repository", () => {
  it("only import zod and the definition contract", () => {
    const srcRoot = join(import.meta.dirname, "..", "..");
    const offenders: string[] = [];

    for (const module of readdirSync(srcRoot, { withFileTypes: true })) {
      if (!module.isDirectory()) continue;
      const directory = join(srcRoot, module.name, "browser", "components");
      let files: string[];
      try {
        files = readdirSync(directory).filter((file) => file.endsWith(".block.ts"));
      } catch {
        continue;
      }
      for (const file of files) {
        const imports = forbiddenImports(readFileSync(join(directory, file), "utf8"));
        if (imports.length > 0) offenders.push(`${module.name}/browser/components/${file}: ${imports.join(", ")}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
