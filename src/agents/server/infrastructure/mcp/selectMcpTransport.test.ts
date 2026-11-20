import { describe, expect, it } from "vitest";

import { selectMcpTransport } from "./selectMcpTransport";

describe("selectMcpTransport", () => {
  it("usa HTTP cuando está desplegado en Vercel", () => {
    expect(selectMcpTransport({ VERCEL: "1" })).toBe("http");
  });

  it("usa STDIO fuera de un despliegue", () => {
    expect(selectMcpTransport({})).toBe("stdio");
    expect(selectMcpTransport({ VERCEL: "" })).toBe("stdio");
  });
});
