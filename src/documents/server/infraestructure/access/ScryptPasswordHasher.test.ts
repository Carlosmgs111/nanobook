import { describe, expect, it } from "vitest";

import { ScryptPasswordHasher } from "./ScryptPasswordHasher";

describe("ScryptPasswordHasher", () => {
  const hasher = new ScryptPasswordHasher();

  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hasher.hash("correcta-12345");

    expect(await hasher.verify("correcta-12345", stored)).toBe(true);
    expect(await hasher.verify("incorrecta-1", stored)).toBe(false);
  });

  it("uses a different salt for every hash and a self-describing format", async () => {
    const first = await hasher.hash("misma-clave-1");
    const second = await hasher.hash("misma-clave-1");

    expect(first).not.toBe(second);
    expect(first.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(first).not.toContain("misma-clave-1");
  });

  it("rejects malformed stored values instead of throwing", async () => {
    expect(await hasher.verify("x", "")).toBe(false);
    expect(await hasher.verify("x", "scrypt$bad")).toBe(false);
    expect(await hasher.verify("x", "bcrypt$a$b$c$d$e")).toBe(false);
  });
});
