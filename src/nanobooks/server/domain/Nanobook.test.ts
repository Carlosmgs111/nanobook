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
    expect(result.getValue().toPersistence()).toMatchObject({
      id: "book-1",
      ownerId: "user-1",
      slug: "manual-equipo",
      visibility: "private",
      settings: {},
      contentVersion: 0,
    });
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
});
