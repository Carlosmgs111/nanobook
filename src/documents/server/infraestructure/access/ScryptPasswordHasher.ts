import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import type { PasswordHasher } from "../../domain/access/ports";

const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, keyLength: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, { N: n, r, p, maxmem: 128 * n * r * 2 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** scrypt hashes encoded as `scrypt$N$r$p$salt$hash` (base64url). */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await derive(password, salt, COST, BLOCK_SIZE, PARALLELISM, KEY_LENGTH);
    return ["scrypt", COST, BLOCK_SIZE, PARALLELISM, salt.toString("base64url"), key.toString("base64url")].join("$");
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, n, r, p, saltValue, hashValue] = parts;
    const cost = Number(n);
    const block = Number(r);
    const parallelism = Number(p);
    if (![cost, block, parallelism].every((value) => Number.isInteger(value) && value > 0)) return false;

    try {
      const salt = Buffer.from(saltValue, "base64url");
      const expected = Buffer.from(hashValue, "base64url");
      if (salt.length === 0 || expected.length === 0) return false;
      const actual = await derive(password, salt, cost, block, parallelism, expected.length);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
}
