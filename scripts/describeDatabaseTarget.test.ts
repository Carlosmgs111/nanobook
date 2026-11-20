import { describe, expect, it } from "vitest";

import { describeDatabaseTarget } from "./describeDatabaseTarget";

describe("describeDatabaseTarget", () => {
  it("shows the path of a local file database", () => {
    expect(describeDatabaseTarget("file:./data/nanobook.db")).toBe("archivo local ./data/nanobook.db");
  });

  it("shows only the host of a remote database", () => {
    expect(describeDatabaseTarget("libsql://mi-base.turso.io?authToken=secreto")).toBe("remota mi-base.turso.io");
  });

  it("never echoes an unparseable value", () => {
    expect(describeDatabaseTarget("no es una url con secreto")).toBe("destino desconocido");
  });
});
