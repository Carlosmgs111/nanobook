import { describe, expect, it } from "vitest";

import { grantCookieName, grantsFromCookieHeader, serializeGrantCookie } from "./GrantCookie";

describe("GrantCookie", () => {
  it("entrega el token presentado de cada documento por su cookie propia", () => {
    const header = `x=1; ${grantCookieName("doc-1")}=tok-1; ${grantCookieName("doc-2")}=tok-2`;
    const grantFor = grantsFromCookieHeader(header);

    expect(grantFor("doc-1")).toBe("tok-1");
    expect(grantFor("doc-2")).toBe("tok-2");
    expect(grantFor("doc-3")).toBeUndefined();
    expect(grantsFromCookieHeader(null)("doc-1")).toBeUndefined();
  });

  it("serializa una cookie HttpOnly con expiración, acotada a /n", () => {
    const cookie = serializeGrantCookie("doc-1", "t.s", 43200);

    expect(cookie).toContain(`${grantCookieName("doc-1")}=t.s`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/n");
    expect(cookie).toContain("Max-Age=43200");
  });
});
