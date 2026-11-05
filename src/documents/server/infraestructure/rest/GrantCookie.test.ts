import { describe, expect, it } from "vitest";

import {
  grantCookieName,
  grantsFromCookieHeader,
  readCookie,
  serializeGrantCookie,
} from "./GrantCookie";

describe("GrantCookie", () => {
  it("derives a stable, document-specific cookie name", () => {
    expect(grantCookieName("doc-1")).toBe(grantCookieName("doc-1"));
    expect(grantCookieName("doc-1")).not.toBe(grantCookieName("doc-2"));
    expect(grantCookieName("doc-1")).toMatch(/^nbk-grant-[0-9a-f]{16}$/);
  });

  it("reads a value from a cookie header", () => {
    expect(readCookie("a=1; b=two; c=3", "b")).toBe("two");
    expect(readCookie("a=1", "missing")).toBeUndefined();
    expect(readCookie(null, "a")).toBeUndefined();
  });

  it("resolves the presented token of each document", () => {
    const header = `x=1; ${grantCookieName("doc-1")}=tok-1; ${grantCookieName("doc-2")}=tok-2`;
    const grantFor = grantsFromCookieHeader(header);

    expect(grantFor("doc-1")).toBe("tok-1");
    expect(grantFor("doc-2")).toBe("tok-2");
    expect(grantFor("doc-3")).toBeUndefined();
    expect(grantsFromCookieHeader(null)("doc-1")).toBeUndefined();
  });

  it("serializes an HttpOnly cookie scoped to /n", () => {
    const cookie = serializeGrantCookie("doc-1", "t.s", 43200);

    expect(cookie).toContain(`${grantCookieName("doc-1")}=t.s`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/n");
    expect(cookie).toContain("Max-Age=43200");
  });
});
