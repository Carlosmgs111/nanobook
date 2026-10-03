import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("global login link contract", () => {
  it("threads loginHref through the layout shell and header", () => {
    const layout = read("src/layouts/Layout.astro");
    const shell = read("src/layouts/components/LayoutShell.astro");
    const header = read("src/layouts/components/Header.astro");

    expect(layout).toContain("loginHref");
    expect(shell).toContain("loginHref");
    expect(header).toContain("loginHref");
    expect(layout).toContain('loginHref = "/login"');
    expect(header).toContain("Ingresar");
  });
});
