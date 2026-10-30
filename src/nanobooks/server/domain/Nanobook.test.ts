import { describe, expect, it } from "vitest";

import { Nanobook } from "./Nanobook";

describe("Nanobook", () => {
  it("creates a private book with stable identity and default settings", () => {
    const result = Nanobook.create({
      id: "book-1",
      ownerId: "user-1",
      slug: "manual-equipo",
      name: "Manual del equipo",
    });

    expect(result.isSuccess).toBe(true);
    const persisted = result.getValue().toPersistence();
    const { createdAt, updatedAt, ...data } = persisted;
    expect(data).toEqual({
      id: "book-1",
      ownerId: "user-1",
      slug: "manual-equipo",
      name: "Manual del equipo",
      visibility: "private",
      settings: {},
      setupStatus: "ready",
    });
    expect(createdAt).toEqual(updatedAt);
  });

  it("keeps legacy empty settings valid and accepts a closed theme reference", () => {
    expect(Nanobook.create({ id: "legacy", ownerId: "user-1", slug: "legacy", name: "Legacy", settings: {} }).isSuccess).toBe(true);
    const themed = Nanobook.create({ id: "new", ownerId: "user-1", slug: "new", name: "New", settings: { theme: { kind: "official", id: "nanobook" } } });
    expect(themed.isSuccess).toBe(true);
  });

  it("supports a pending setup status and immutable status changes", () => {
    const result = Nanobook.create({
      id: "book-1",
      ownerId: "user-1",
      slug: "manual-equipo",
      name: "Manual del equipo",
      setupStatus: "pending",
    });

    expect(result.isSuccess).toBe(true);
    const pending = result.getValue();
    expect(pending.getSetupStatus()).toBe("pending");
    expect(pending.withSetupStatus("ready").getSetupStatus()).toBe("ready");
    expect(pending.getSetupStatus()).toBe("pending");
  });

  it("rejects an invalid slug and an empty name", () => {
    expect(
      Nanobook.create({
        id: "book-1",
        ownerId: "user-1",
        slug: "Manual Equipo",
        name: "Manual",
      }).isSuccess
    ).toBe(false);

    expect(
      Nanobook.create({
        id: "book-1",
        ownerId: "user-1",
        slug: "manual-equipo",
        name: "  ",
      }).isSuccess
    ).toBe(false);
  });

  it("rejects provider settings until they are part of the typed contract", () => {
    const result = Nanobook.create({
      id: "book-1",
      ownerId: "user-1",
      slug: "manual-equipo",
      name: "Manual del equipo",
      settings: { provider: "github" } as never,
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError().message).toContain("settings contiene campos no permitidos");
  });
});
