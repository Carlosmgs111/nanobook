import { readFile } from 'node:fs/promises';
import { describe, expect, it } from "vitest";

describe("ToastHost", () => {
  it("declares toast markup in an Astro template instead of constructing it with the DOM", async () => {
    const source = await readFile(new URL("./ToastHost.astro", import.meta.url), "utf8");

    expect(source).toMatch(/<template[^>]*data-toast-template[^>]*>[\s\S]*?<article[^>]*class="toast-host__item"[\s\S]*?<p[^>]*class="toast-host__message"[\s\S]*?<button[^>]*class="toast-host__close"[\s\S]*?<\/template>/);
    expect(source).not.toContain("document.createElement(");
  });
});
