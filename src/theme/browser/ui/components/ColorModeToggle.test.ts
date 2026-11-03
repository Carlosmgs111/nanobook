import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ColorModeToggle.astro", import.meta.url), "utf8");
const script = source.match(/<script type="module">([\s\S]*?)<\/script>/)![1];

describe("ColorModeToggle", () => {
  it.each([
    ["light", "dark"],
    ["dark", "light"],
  ])("alternates on every click from %s", (initial, first) => {
    const root = { dataset: { colorMode: initial } };
    let click = () => {};
    const toggle = {
      dataset: {} as Record<string, string>,
      addEventListener: (_event: string, handler: () => void) => { click = handler; },
    };
    const document = {
      documentElement: root,
      cookie: "",
      getElementById: () => toggle,
      addEventListener: (_event: string, handler: () => void) => handler(),
    };
    runInNewContext(script, { document });

    for (const expected of [first, first === "dark" ? "light" : "dark", first]) {
      click();
      expect(root.dataset.colorMode).toBe(expected);
      expect(document.cookie).toBe(`nanobook-color-mode=${expected}; Path=/; SameSite=Lax`);
    }
  });
});
