import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

import type { AccessGrantCodec, IssuedGrant } from "../../domain/access/ports";

interface GrantPayload {
  d: string;
  v: number;
  exp: number;
}

/**
 * Signs `{ documentId, passwordVersion, exp }` with an HKDF-derived key so the
 * application secret is never used raw for grants.
 */
export class HmacAccessGrantCodec implements AccessGrantCodec {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = Buffer.from(hkdfSync("sha256", secret, "nanobook", "document-access-grant:v1", 32));
  }

  cookieName(documentId: string): string {
    return `nbk-grant-${createHash("sha256").update(documentId).digest("hex").slice(0, 16)}`;
  }

  issue(input: { documentId: string; passwordVersion: number; now: Date; ttlSeconds: number }): IssuedGrant {
    const exp = Math.floor(input.now.getTime() / 1000) + input.ttlSeconds;
    const payload = Buffer.from(
      JSON.stringify({ d: input.documentId, v: input.passwordVersion, exp } satisfies GrantPayload),
    ).toString("base64url");
    return { token: `${payload}.${this.sign(payload)}`, expiresAt: new Date(exp * 1000) };
  }

  verify(token: string, input: { documentId: string; passwordVersion: number; now: Date }): boolean {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const [payload, signature] = parts;

    const expected = Buffer.from(this.sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;

    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<GrantPayload>;
      return (
        data.d === input.documentId &&
        data.v === input.passwordVersion &&
        typeof data.exp === "number" &&
        data.exp > Math.floor(input.now.getTime() / 1000)
      );
    } catch {
      return false;
    }
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.key).update(payload).digest("base64url");
  }
}
