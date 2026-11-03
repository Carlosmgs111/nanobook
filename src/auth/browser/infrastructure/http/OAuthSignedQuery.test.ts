import { describe, expect, it } from "vitest";

import { getSignedOAuthQuery } from "./OAuthSignedQuery";

describe("getSignedOAuthQuery", () => {
  it("forwards only values covered by Better Auth's signed parameter list", () => {
    expect(getSignedOAuthQuery(
      "?client_id=codex&scope=nanobooks%3Aread&ba_param=client_id&ba_param=scope&sig=signature&view=preview",
    )).toBe(
      "client_id=codex&scope=nanobooks%3Aread&ba_param=client_id&ba_param=scope&sig=signature",
    );
  });

  it("rejects an unsigned query", () => {
    expect(getSignedOAuthQuery("?client_id=codex")).toBeUndefined();
  });
});
