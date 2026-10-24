import type { JWTPayload } from "jose";

import type { AgentActor } from "../../application/dto";

export class InvalidMcpActorClaimsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMcpActorClaimsError";
  }
}

export function readMcpActor(claims: JWTPayload): AgentActor {
  if (!claims.sub || typeof claims.sub !== "string") {
    throw new InvalidMcpActorClaimsError("El token MCP no contiene un subject válido");
  }
  if (!claims.client_id || typeof claims.client_id !== "string") {
    throw new InvalidMcpActorClaimsError("El token MCP no contiene un client_id válido");
  }
  const scope = claims.scope;
  if (typeof scope !== "string") {
    throw new InvalidMcpActorClaimsError("El token MCP no contiene scopes válidos");
  }
  return { actorId: claims.sub, oauthClientId: claims.client_id, scopes: scope.split(" ").filter(Boolean) };
}
