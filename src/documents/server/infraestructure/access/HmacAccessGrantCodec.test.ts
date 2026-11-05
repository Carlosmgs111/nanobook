import { describe, expect, it } from "vitest";

import { HmacAccessGrantCodec } from "./HmacAccessGrantCodec";

const now = new Date("2026-11-04T12:00:00.000Z");
const secret = "a-secret-with-more-than-thirty-two-chars";

describe("HmacAccessGrantCodec", () => {
  const codec = new HmacAccessGrantCodec(secret);
  const grant = codec.issue({ documentId: "doc-1", passwordVersion: 2, now, ttlSeconds: 3600 });

  it("accepts a fresh grant for the same document and version", () => {
    expect(codec.verify(grant.token, { documentId: "doc-1", passwordVersion: 2, now })).toBe(true);
    expect(grant.expiresAt).toEqual(new Date("2026-11-04T13:00:00.000Z"));
  });

  it("rejects another document or another password version", () => {
    expect(codec.verify(grant.token, { documentId: "doc-2", passwordVersion: 2, now })).toBe(false);
    expect(codec.verify(grant.token, { documentId: "doc-1", passwordVersion: 3, now })).toBe(false);
  });

  it("rejects an expired grant", () => {
    const later = new Date(now.getTime() + 3601 * 1000);

    expect(codec.verify(grant.token, { documentId: "doc-1", passwordVersion: 2, now: later })).toBe(false);
  });

  it("rejects tampered or malformed tokens", () => {
    const [payload, signature] = grant.token.split(".");
    const forged = Buffer.from(JSON.stringify({ d: "doc-1", v: 2, exp: 99999999999 })).toString("base64url");

    expect(codec.verify(`${payload}.${signature.slice(0, -2)}xx`, { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
    expect(codec.verify(`${forged}.${signature}`, { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
    expect(codec.verify("garbage", { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
    expect(codec.verify("", { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
  });

  it("does not validate with a different secret", () => {
    const other = new HmacAccessGrantCodec("another-secret-with-more-than-thirty-two");

    expect(other.verify(grant.token, { documentId: "doc-1", passwordVersion: 2, now })).toBe(false);
  });
});
