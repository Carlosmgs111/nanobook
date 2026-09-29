import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("global profile link contract", () => {
  it("threads profileHref through the layout shell and header", () => {
    const layout = read("src/layouts/Layout.astro");
    const shell = read("src/layouts/components/LayoutShell.astro");
    const header = read("src/layouts/components/Header.astro");

    expect(layout).toContain("profileHref");
    expect(shell).toContain("profileHref");
    expect(header).toContain("profileHref");
    expect(header).toContain("Perfil");
  });
});
