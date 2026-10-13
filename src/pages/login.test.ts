import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("login page", () => {
  it("offers a black button back to the home page", () => {
    const login = read("src/auth/browser/ui/AuthForm.astro");

    expect(login).toContain('href="/"');
    expect(login).toContain("Volver al inicio");
    expect(login).toContain("bg-black");
    expect(login).toContain("!text-white");
  });
});
