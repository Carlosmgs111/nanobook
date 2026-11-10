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
      "/src/b/browser/components/Beta/Beta.block.ts": { default: definition("beta-block") },
      "/src/a/browser/components/Alpha/Alpha.block.ts": { default: definition("alpha-block") },
    });

    expect(collected.map(({ name }) => name)).toEqual(["alpha-block", "beta-block"]);
  });

  it("fails naming the module that has no default export", () => {
    expect(() =>
      collectFrameworkBlockDefinitions({ "/src/a/browser/components/Alpha/Alpha.block.ts": {} }),
    ).toThrow("/src/a/browser/components/Alpha/Alpha.block.ts");
  });

  it("fails naming the module whose block name is not allowed", () => {
    expect(() =>
      collectFrameworkBlockDefinitions({
        "/src/a/browser/components/Alpha/Alpha.block.ts": { default: definition("Alpha Block") },
      }),
    ).toThrow(/Alpha\.block\.ts.*Alpha Block/s);
  });

  it("fails naming both modules when two blocks share a name", () => {
    expect(() =>
      collectFrameworkBlockDefinitions({
        "/src/a/browser/components/One/One.block.ts": { default: definition("same-name") },
        "/src/b/browser/components/Two/Two.block.ts": { default: definition("same-name") },
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

/**
 * Importaciones que un `*.block.ts` o un `*.schema.ts` puede tener: el servidor y
 * el Worker los cargan. Además de `zod` y el contrato, pueden importar un
 * `./Nombre.schema` de su carpeta y el `shared/` de su propio módulo
 * (`../../../shared/…` desde `<módulo>/browser/components/<Nombre>/`), que por
 * convención no depende de frameworks, del navegador ni de Node.
 */
function forbiddenImports(source: string): string[] {
  const specifiers = [...source.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  return specifiers.filter(
    (specifier) =>
      specifier !== "zod" &&
      !specifier.endsWith("rendering/shared/componentBlocks/ComponentBlockDefinition") &&
      !/^\.\/[\w.-]+\.schema$/.test(specifier) &&
      !/^\.\.\/\.\.\/\.\.\/shared\//.test(specifier),
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

  it("accepts the shared folder of the block's own module", () => {
    const source = 'import type { FinancialBlock } from "../../../shared/model/FinancialBlock";';

    expect(forbiddenImports(source)).toEqual([]);
  });

  it("accepts the schema file of the block's own folder", () => {
    expect(forbiddenImports('import { priceChartProps } from "./PriceChart.schema";')).toEqual([]);
  });

  it("flags the component next to the block, since it may import a framework", () => {
    expect(forbiddenImports('import PriceChart from "./PriceChart";')).toEqual(["./PriceChart"]);
  });

  it("flags the previous flat depth, which no longer reaches the module's shared folder", () => {
    expect(forbiddenImports('import a from "../../shared/model/FinancialBlock";')).toEqual([
      "../../shared/model/FinancialBlock",
    ]);
  });

  it("flags the server and browser folders, the global shared folder and other modules", () => {
    const source = [
      'import a from "../server/thing";',
      'import b from "../ui/Thing";',
      'import c from "../../../../shared/server/http/ServerTiming";',
      'import d from "../../../../other-module/shared/thing";',
    ].join("\n");

    expect(forbiddenImports(source)).toEqual([
      "../server/thing",
      "../ui/Thing",
      "../../../../shared/server/http/ServerTiming",
      "../../../../other-module/shared/thing",
    ]);
  });

  it("flags framework and node imports", () => {
    const source = ['import { useState } from "react";', 'import fs from "node:fs";'].join("\n");

    expect(forbiddenImports(source)).toEqual(["react", "node:fs"]);
  });
});

describe("*.block.ts and *.schema.ts files in the repository", () => {
  it("only import zod, the definition contract, their own schema and their module's shared folder", () => {
    const srcRoot = join(import.meta.dirname, "..", "..");
    const offenders: string[] = [];

    for (const module of readdirSync(srcRoot, { withFileTypes: true })) {
      if (!module.isDirectory()) continue;
      const components = join(srcRoot, module.name, "browser", "components");
      let folders: string[];
      try {
        folders = readdirSync(components, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
      } catch {
        continue;
      }
      for (const folder of folders) {
        const directory = join(components, folder);
        const files = readdirSync(directory).filter((file) => /.(block|schema).ts$/.test(file));
        for (const file of files) {
          const imports = forbiddenImports(readFileSync(join(directory, file), "utf8"));
          if (imports.length > 0) {
            offenders.push(`${module.name}/browser/components/${folder}/${file}: ${imports.join(", ")}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
