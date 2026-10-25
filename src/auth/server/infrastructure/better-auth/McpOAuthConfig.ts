const CODEX_CIMD_HOST = "chatgpt.com";
const CODEX_CIMD_PATH = /^\/oauth\/(?:client\.json|[^/]+\/client\.json|codex\/[^/]+\/client\.json)$/;

export interface McpOAuthConfig {
  resource: string;
  loginPage: string;
  consentPage: string;
}

export function getMcpOAuthConfig(baseURL: string): McpOAuthConfig {
  const origin = parseOrigin(baseURL);

  if (!isLoopback(origin.hostname) && origin.protocol !== "https:") {
    throw new Error("MCP resource must use HTTPS outside loopback development.");
  }

  return {
    resource: new URL("/mcp", origin).toString(),
    loginPage: "/login",
    consentPage: "/consent",
  };
}

export function isCodexClientMetadataUrlAllowed(clientId: string): boolean {
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return false;
  }

  return (
    url.protocol === "https:"
    && url.hostname === CODEX_CIMD_HOST
    && url.port === ""
    && url.username === ""
    && url.password === ""
    && url.search === ""
    && url.hash === ""
    && CODEX_CIMD_PATH.test(url.pathname)
  );
}

function parseOrigin(baseURL: string): URL {
  let origin: URL;
  try {
    origin = new URL(baseURL);
  } catch {
    throw new Error("MCP resource requires an absolute application origin.");
  }

  if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error("MCP resource requires an application origin without a path, credentials, query or hash.");
  }

  return origin;
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
