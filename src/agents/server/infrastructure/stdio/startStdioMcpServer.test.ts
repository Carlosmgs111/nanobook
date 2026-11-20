import { describe, expect, it } from "vitest";

import { STDIO_CLIENT_ID, createStdioActor } from "./startStdioMcpServer";

describe("createStdioActor", () => {
  it("actúa como el usuario local con lectura y escritura, marcado como cliente STDIO", () => {
    expect(createStdioActor("user-1")).toEqual({
      actorId: "user-1",
      oauthClientId: STDIO_CLIENT_ID,
      scopes: ["nanobooks:read", "nanobooks:write"],
    });
  });

  it("rechaza un usuario vacío", () => {
    expect(() => createStdioActor("  ")).toThrow("usuario");
  });
});
