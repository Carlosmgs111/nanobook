import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverBlocks } from "./discoverBlocks";

let src: string;

beforeEach(() => {
  src = mkdtempSync(join(tmpdir(), "nanobook-blocks-"));
});

afterEach(() => {
  rmSync(src, { recursive: true, force: true });
});

/** Carpeta de un bloque: `src/<módulo>/browser/components/<carpeta>/`. */
function componentsDir(module: string, folder = "Block"): string {
  const directory = join(src, module, "browser", "components", folder);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function touch(directory: string, ...files: string[]): void {
  for (const file of files) writeFileSync(join(directory, file), "");
}

/** Sustituye la importación real: devuelve la definición registrada para cada archivo `.block.ts`. */
function importing(definitions: Record<string, unknown>) {
  return async (file: string) => ({ default: definitions[basename(file)] });
}

describe("discoverBlocks", () => {
  it("pairs a block definition with its sibling component", async () => {
    const dir = componentsDir("alpha");
    touch(dir, "Counter.block.ts", "Counter.tsx");

    const entries = await discoverBlocks(src, importing({ "Counter.block.ts": { name: "counter-demo" } }));

    expect(entries).toEqual([
      {
        name: "counter-demo",
        blockFile: join(dir, "Counter.block.ts"),
        componentFile: join(dir, "Counter.tsx"),
      },
    ]);
  });

  it.each([".tsx", ".jsx", ".vue", ".svelte"])("accepts a %s component", async (extension) => {
    const dir = componentsDir("alpha");
    touch(dir, "Thing.block.ts", `Thing${extension}`);

    const [entry] = await discoverBlocks(src, importing({ "Thing.block.ts": { name: "thing-block" } }));

    expect(entry.componentFile).toBe(join(dir, `Thing${extension}`));
  });

  it("accepts an .astro component as a server-only block", async () => {
    const dir = componentsDir("alpha");
    touch(dir, "Card.block.ts", "Card.astro");

    const [entry] = await discoverBlocks(src, importing({ "Card.block.ts": { name: "card-block" } }));

    expect(entry.componentFile).toBe(join(dir, "Card.astro"));
    expect(entry.hydrate).toBeUndefined();
  });

  it.each(["load", "idle", "visible"])("carries hydrate=%s from the definition", async (hydrate) => {
    touch(componentsDir("alpha"), "Live.block.ts", "Live.tsx");

    const [entry] = await discoverBlocks(src, importing({ "Live.block.ts": { name: "live-block", hydrate } }));

    expect(entry.hydrate).toBe(hydrate);
  });

  it("fails when hydrate is not a known directive", async () => {
    touch(componentsDir("alpha"), "Live.block.ts", "Live.tsx");

    await expect(
      discoverBlocks(src, importing({ "Live.block.ts": { name: "live-block", hydrate: "media" } })),
    ).rejects.toThrow(/Live\.block\.ts.*hydrate.*media/s);
  });

  it("fails when an .astro component asks to hydrate", async () => {
    touch(componentsDir("alpha"), "Card.block.ts", "Card.astro");

    await expect(
      discoverBlocks(src, importing({ "Card.block.ts": { name: "card-block", hydrate: "visible" } })),
    ).rejects.toThrow(/Card\.block\.ts.*\.astro.*hidrat/s);
  });

  it("ignores components that have no block definition", async () => {
    touch(componentsDir("alpha"), "Plain.tsx", "Other.vue");

    expect(await discoverBlocks(src, importing({}))).toEqual([]);
  });

  it("ignores a folder that has components but no block definition", async () => {
    touch(componentsDir("alpha", "Plain"), "Plain.tsx", "Plain.test.ts");

    expect(await discoverBlocks(src, importing({}))).toEqual([]);
  });

  it("finds blocks in several folders of the same module", async () => {
    touch(componentsDir("alpha", "One"), "One.block.ts", "One.tsx");
    touch(componentsDir("alpha", "Two"), "Two.block.ts", "Two.astro");

    const entries = await discoverBlocks(
      src,
      importing({ "One.block.ts": { name: "one-block" }, "Two.block.ts": { name: "two-block" } }),
    );

    expect(entries.map(({ name }) => name)).toEqual(["one-block", "two-block"]);
  });

  it("does not pair a block with a component from another folder", async () => {
    touch(componentsDir("alpha", "One"), "One.block.ts");
    touch(componentsDir("alpha", "Other"), "One.tsx");

    await expect(discoverBlocks(src, importing({ "One.block.ts": { name: "one-block" } }))).rejects.toThrow(
      /One.block.ts.*componente hermano/s,
    );
  });

  it("fails on a block definition left directly in browser/components, which would otherwise be ignored", async () => {
    const flat = join(src, "alpha", "browser", "components");
    mkdirSync(flat, { recursive: true });
    touch(flat, "Loose.block.ts", "Loose.tsx");

    await expect(discoverBlocks(src, importing({ "Loose.block.ts": { name: "loose-block" } }))).rejects.toThrow(
      /Loose.block.ts.*carpeta/s,
    );
  });

  it("ignores modules without browser/components", async () => {
    mkdirSync(join(src, "empty-module"), { recursive: true });
    mkdirSync(join(src, "server-only", "server"), { recursive: true });

    expect(await discoverBlocks(src, importing({}))).toEqual([]);
  });

  it("orders entries by block name across modules", async () => {
    touch(componentsDir("alpha"), "Zeta.block.ts", "Zeta.tsx");
    touch(componentsDir("beta"), "Alpha.block.ts", "Alpha.vue");

    const entries = await discoverBlocks(
      src,
      importing({ "Zeta.block.ts": { name: "zeta-block" }, "Alpha.block.ts": { name: "alpha-block" } }),
    );

    expect(entries.map(({ name }) => name)).toEqual(["alpha-block", "zeta-block"]);
  });

  it("fails when a block definition has no sibling component", async () => {
    touch(componentsDir("alpha"), "Lonely.block.ts");

    await expect(discoverBlocks(src, importing({ "Lonely.block.ts": { name: "lonely-block" } }))).rejects.toThrow(
      /Lonely\.block\.ts.*componente hermano/s,
    );
  });

  it("fails listing every candidate when there is more than one sibling component", async () => {
    touch(componentsDir("alpha"), "Both.block.ts", "Both.tsx", "Both.vue");

    await expect(discoverBlocks(src, importing({ "Both.block.ts": { name: "both-block" } }))).rejects.toThrow(
      /Both\.tsx.*Both\.vue/s,
    );
  });

  it("fails when the definition has no default export with a name", async () => {
    touch(componentsDir("alpha"), "Bad.block.ts", "Bad.tsx");

    await expect(discoverBlocks(src, importing({}))).rejects.toThrow(/Bad\.block\.ts/);
  });

  it("fails when the block name is not allowed", async () => {
    touch(componentsDir("alpha"), "Bad.block.ts", "Bad.tsx");

    await expect(discoverBlocks(src, importing({ "Bad.block.ts": { name: "Bad Name" } }))).rejects.toThrow(
      /Bad\.block\.ts.*Bad Name/s,
    );
  });

  it("fails naming both files when two definitions share a name", async () => {
    touch(componentsDir("alpha"), "One.block.ts", "One.tsx");
    touch(componentsDir("beta"), "Two.block.ts", "Two.vue");

    await expect(
      discoverBlocks(
        src,
        importing({ "One.block.ts": { name: "same-name" }, "Two.block.ts": { name: "same-name" } }),
      ),
    ).rejects.toThrow(/same-name.*One\.block\.ts.*Two\.block\.ts/s);
  });
});
