import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { buildGeneratedFiles } from "./buildGeneratedFiles";

const srcRoot = join(import.meta.dirname, "..", "..", "..");

it("keeps the committed generated files in sync with the components in src", async () => {
  const expected = await buildGeneratedFiles(srcRoot, (file) => import(/* @vite-ignore */ pathToFileURL(file).href));

  expect(expected.length).toBeGreaterThan(0);
  for (const { path, content } of expected) {
    const committed = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
    expect(committed, `${path} está desactualizado: ejecuta "npm run blocks:generate"`).toBe(content);
  }
});
