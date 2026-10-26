import { describe, expect, it } from "vitest";
import { InvalidMcpActorClaimsError, readMcpActor } from "./McpActorReader";

describe("readMcpActor", () => {
  it("uses only verified JWT claims", () => {
    expect(readMcpActor({ sub: "user-1", client_id: "codex", scope: "nanobooks:read nanobooks:write" })).toEqual({ actorId: "user-1", oauthClientId: "codex", scopes: ["nanobooks:read", "nanobooks:write"] });
  });
  it("rejects incomplete claims", () => {
    expect(() => readMcpActor({ sub: "user-1", scope: "nanobooks:read" })).toThrow(InvalidMcpActorClaimsError);
  });
});
