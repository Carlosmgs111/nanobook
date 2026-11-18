import { describe, expect, it } from "vitest";

import { ScryptPasswordHasher } from "./ScryptPasswordHasher";

describe("ScryptPasswordHasher", () => {
  const hasher = new ScryptPasswordHasher();

  it("verifica la contraseña correcta y rechaza la incorrecta", async () => {
    const stored = await hasher.hash("correcta-12345");

    expect(await hasher.verify("correcta-12345", stored)).toBe(true);
    expect(await hasher.verify("incorrecta-1", stored)).toBe(false);
  });

  it("usa sal distinta por hash y no contiene la contraseña", async () => {
    const first = await hasher.hash("misma-clave-1");

    expect(first).not.toBe(await hasher.hash("misma-clave-1"));
    expect(first).not.toContain("misma-clave-1");
  });

  it("rechaza valores almacenados mal formados sin lanzar", async () => {
    expect(await hasher.verify("x", "")).toBe(false);
    expect(await hasher.verify("x", "scrypt$bad")).toBe(false);
    expect(await hasher.verify("x", "bcrypt$a$b$c$d$e")).toBe(false);
  });
});
