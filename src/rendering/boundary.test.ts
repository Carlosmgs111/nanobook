import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );

const specifiers = (source: string) =>
  [...source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)].map((match) => match[1]);

const sources = files("src").filter((path) => /\.(ts|astro)$/.test(path));
const posix = (path: string) => relative("src", path).split(sep).join("/");

describe("rendering boundaries", () => {
  it("is only reached through its public entry points", () => {
    const allowed = /(?:^|\/)rendering\/(?:shared|server)$|(?:^|\/)rendering\/browser\/ui\/[^/]+\.astro$/;
    const offenders = sources
      .filter((path) => !posix(path).startsWith("rendering/"))
      .flatMap((path) =>
        specifiers(readFileSync(path, "utf8"))
          .filter((spec) => /(?:^|\/)rendering\//.test(spec) && !allowed.test(spec))
          .map((spec) => `${posix(path)} → ${spec}`),
      );

    expect(offenders).toEqual([]);
  });

  it("does not depend on any other module", () => {
    const offenders = sources
      .filter((path) => posix(path).startsWith("rendering/"))
      .flatMap((path) =>
        specifiers(readFileSync(path, "utf8"))
          .filter((spec) => spec.startsWith("."))
          .filter((spec) => {
            const target = join(path, "..", spec);
            // `src/shared` es infraestructura transversal, no un módulo de negocio.
            return !target.startsWith(join("src", "rendering")) && !target.startsWith(join("src", "shared"));
          })
          .map((spec) => `${posix(path)} → ${spec}`),
      );

    expect(offenders).toEqual([]);
  });
});
