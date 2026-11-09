import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { relativeImportPath, renderHostSource } from "./renderHostSource";

describe("renderHostSource", () => {
  it("marks both files as generated", () => {
    const { host, ssrBlockNames } = renderHostSource([]);

    expect(host).toContain("GENERADO por scripts/generate-component-blocks.ts");
    expect(ssrBlockNames).toContain("GENERADO por scripts/generate-component-blocks.ts");
  });

  it("produces a valid host with no imports or tags when there are no components", () => {
    const { host, ssrBlockNames } = renderHostSource([]);

    expect(host).not.toMatch(/^import /m);
    expect(host).not.toContain("client:visible");
    expect(ssrBlockNames).toContain("new Set<string>([])");
  });

  it("imports each component and renders it with a static tag and its hydration directive", () => {
    const { host } = renderHostSource([
      { name: "counter-demo", importPath: "../../components/Counter.tsx", hydrate: "visible" },
    ]);

    expect(host).toContain('import Block0 from "../../components/Counter.tsx";');
    expect(host).toContain('{name === "counter-demo" && <Block0 {...blockProps} client:visible />}');
  });

  it.each(["load", "idle", "visible"] as const)("emits the literal client:%s directive", (hydrate) => {
    const { host } = renderHostSource([{ name: "thing-block", importPath: "./Thing.tsx", hydrate }]);

    expect(host).toContain(`<Block0 {...blockProps} client:${hydrate} />`);
  });

  it("renders a block without hydrate as server-only HTML, with no client directive", () => {
    const { host } = renderHostSource([{ name: "static-block", importPath: "./Static.astro" }]);

    expect(host).toContain('{name === "static-block" && <Block0 {...blockProps} />}');
    expect(host).not.toContain("client:");
  });

  it("orders entries by block name regardless of input order", () => {
    const { host, ssrBlockNames } = renderHostSource([
      { name: "zeta-block", importPath: "./Zeta.vue" },
      { name: "alpha-block", importPath: "./Alpha.tsx" },
    ]);

    expect(host.indexOf('import Block0 from "./Alpha.tsx"')).toBeGreaterThan(-1);
    expect(host.indexOf('import Block1 from "./Zeta.vue"')).toBeGreaterThan(-1);
    expect(ssrBlockNames).toContain('new Set<string>(["alpha-block","zeta-block"])');
  });

  it("is deterministic and uses only LF line endings with a final newline", () => {
    const entries = [{ name: "alpha-block", importPath: "./Alpha.tsx" }];
    const first = renderHostSource(entries);
    const second = renderHostSource(entries);

    expect(second).toEqual(first);
    for (const source of [first.host, first.ssrBlockNames]) {
      expect(source).not.toContain("\r");
      expect(source.endsWith("\n")).toBe(true);
    }
  });

  it("escapes names so they cannot break out of the string literal", () => {
    const { host } = renderHostSource([{ name: 'a"b', importPath: "./A.tsx" }]);

    expect(host).toContain('name === "a\\"b"');
  });
});

describe("relativeImportPath", () => {
  it("returns a forward-slash path relative to the importing directory", () => {
    const from = resolve("/project/src/application/browser/ui/generated");
    const file = resolve("/project/src/application/browser/components/Counter.tsx");

    expect(relativeImportPath(from, file)).toBe("../../components/Counter.tsx");
  });

  it("prefixes ./ for files below the importing directory", () => {
    const from = resolve("/project/src/generated");

    expect(relativeImportPath(from, resolve("/project/src/generated/sub/Thing.vue"))).toBe("./sub/Thing.vue");
  });

  it("never contains backslashes", () => {
    const from = resolve("/project/src/a/b");

    expect(relativeImportPath(from, resolve("/project/src/c/d/E.svelte"))).not.toContain("\\");
  });
});
