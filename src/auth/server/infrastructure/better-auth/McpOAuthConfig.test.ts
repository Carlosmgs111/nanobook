import { describe, expect, it } from "vitest";

import {
  getMcpOAuthConfig,
  isCodexClientMetadataUrlAllowed,
} from "./McpOAuthConfig";

describe("MCP OAuth configuration", () => {
  it("derives the protected resource and internal pages from a production origin", () => {
    expect(getMcpOAuthConfig("https://nanobook.example.com")).toEqual({
      resource: "https://nanobook.example.com/mcp",
      loginPage: "/login",
      consentPage: "/consent",
    });
  });

  it("rejects a non-HTTPS production origin", () => {
    expect(() => getMcpOAuthConfig("http://nanobook.example.com")).toThrow(
      "MCP resource must use HTTPS outside loopback development.",
    );
  });

  it("allows loopback development", () => {
    expect(getMcpOAuthConfig("http://127.0.0.1:4322").resource).toBe(
      "http://127.0.0.1:4322/mcp",
    );
  });

  it.each([
    "https://chatgpt.com/oauth/client.json",
    "https://chatgpt.com/oauth/a-safe-callback-id/client.json",
    "https://chatgpt.com/oauth/codex/a-safe-callback-id/client.json",
  ])("allows a documented Codex CIMD client metadata URL: %s", (clientId) => {
    expect(
      isCodexClientMetadataUrlAllowed(clientId),
    ).toBe(true);
  });

  it.each([
    "http://chatgpt.com/oauth/codex/callback/client.json",
    "https://example.com/oauth/codex/callback/client.json",
    "https://chatgpt.com/oauth/codex/callback/other.json",
    "https://chatgpt.com/oauth/codex/callback/client.json?unexpected=value",
    "https://user:password@chatgpt.com/oauth/codex/callback/client.json",
  ])("rejects an untrusted CIMD URL: %s", (clientId) => {
    expect(isCodexClientMetadataUrlAllowed(clientId)).toBe(false);
  });
});
