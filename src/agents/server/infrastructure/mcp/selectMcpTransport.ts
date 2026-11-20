export type McpTransportKind = "http" | "stdio";

/**
 * Canal con el que se sirve el MCP según dónde corre el proyecto. Es el mismo servidor
 * (`createNanobookMcpServer`) en ambos casos; solo cambia el transporte y de dónde sale la identidad:
 * - desplegado (`VERCEL=1`): HTTP en `POST /mcp`, con OAuth 2.1;
 * - local: STDIO, que lanza el propio cliente en la máquina y no necesita OAuth.
 */
export function selectMcpTransport(env: { VERCEL?: string }): McpTransportKind {
  return env.VERCEL === "1" ? "http" : "stdio";
}
