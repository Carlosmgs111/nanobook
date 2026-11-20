import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

import type { AgentToolService } from "../../application/AgentToolService";
import type { AgentActor } from "../../application/dto";
import { createNanobookMcpServer } from "../mcp/createNanobookMcpServer";

/** Identificador con el que quedan auditadas las escrituras hechas por el canal STDIO. */
export const STDIO_CLIENT_ID = "stdio-local";

/**
 * Actor del canal STDIO: no hay OAuth porque el cliente lanza el proceso en la propia máquina,
 * así que actúa con la identidad del usuario local elegido y con todos los scopes. La autorización
 * por recurso (`Authorizer`) sigue aplicándose igual que en el canal HTTP.
 */
export function createStdioActor(userId: string): AgentActor {
  if (!userId.trim()) throw new Error("El canal STDIO necesita el id de un usuario.");
  return {
    actorId: userId,
    oauthClientId: STDIO_CLIENT_ID,
    scopes: ["nanobooks:read", "nanobooks:write"],
  };
}

/** Sirve las herramientas del agente por la entrada y la salida estándar del proceso. */
export async function startStdioMcpServer(actor: AgentActor, tools: AgentToolService) {
  const server = createNanobookMcpServer(actor, tools);
  await server.connect(new StdioServerTransport());
  return server;
}
