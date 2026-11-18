import { describe, expect, it } from "vitest";

import { HmacAccessGrantCodec } from "./HmacAccessGrantCodec";

const now = new Date("2026-11-04T12:00:00.000Z");
const secret = "a-secret-with-more-than-thirty-two-chars";
const subject = { documentId: "doc-1", passwordVersion: 2, now };

describe("HmacAccessGrantCodec", () => {
  const codec = new HmacAccessGrantCodec(secret);
  const token = codec.issue({ documentId: "doc-1", passwordVersion: 2, now, ttlSeconds: 3600 });

  it("acepta un grant vigente del mismo documento y versión", () => {
    expect(codec.verify(token, subject)).toBe(true);
  });

  it("rechaza otro documento, otra versión de contraseña o un grant expirado", () => {
    expect(codec.verify(token, { ...subject, documentId: "doc-2" })).toBe(false);
    expect(codec.verify(token, { ...subject, passwordVersion: 3 })).toBe(false);
    expect(codec.verify(token, { ...subject, now: new Date(now.getTime() + 3601 * 1000) })).toBe(false);
  });

  it("rechaza tokens manipulados, mal formados o firmados con otro secreto", () => {
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ d: "doc-1", v: 2, exp: 99999999999 })).toString("base64url");

    expect(codec.verify(`${payload}.${signature.slice(0, -2)}xx`, subject)).toBe(false);
    expect(codec.verify(`${forged}.${signature}`, subject)).toBe(false);
    expect(codec.verify("garbage", subject)).toBe(false);
    expect(codec.verify("", subject)).toBe(false);
    expect(new HmacAccessGrantCodec("another-secret-with-more-than-thirty-two").verify(token, subject)).toBe(false);
  });
});
