import { describe, expect, it } from "vitest";
import { Result } from "../../shared/domain/Result";
import { User } from "./User";
import { InvalidUserError } from "./errors";

describe("User", () => {
  it("generates an opaque stable identity when none is supplied", () => {
    const result = User.create({
      email: "  Ada@Example.COM ",
      displayName: " Ada Lovelace ",
      now: new Date("2026-09-29T10:00:00.000Z"),
    });

    expect(result.isSuccess).toBe(true);
    const user = result.getValue();
    expect(user.getId().getValue()).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.toProfile()).toMatchObject({
      email: "ada@example.com",
      displayName: "Ada Lovelace",
      createdAt: new Date("2026-09-29T10:00:00.000Z"),
      updatedAt: new Date("2026-09-29T10:00:00.000Z"),
    });
  });

  it("preserves an explicitly supplied valid identity", () => {
    const result = User.create({
      id: "user-123",
      email: "user@example.com",
      displayName: "User",
    });

    expect(result.getValue().getId().getValue()).toBe("user-123");
  });

  it.each([
    ["", "blank email"],
    ["not-an-email", "malformed email"],
  ])("rejects %s", (email) => {
    const result = User.create({ email, displayName: "User" });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidUserError);
  });

  it("rejects a blank display name", () => {
    const result = User.create({
      email: "user@example.com",
      displayName: "   ",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(InvalidUserError);
  });

  it("preserves createdAt and identity while updating the profile", () => {
    const createdAt = new Date("2026-09-29T10:00:00.000Z");
    const updatedAt = new Date("2026-09-29T11:00:00.000Z");
    const user = User.create({
      id: "user-123",
      email: "old@example.com",
      displayName: "Old Name",
      now: createdAt,
    }).getValue();

    const result = user.updateProfile({
      email: " NEW@Example.com ",
      displayName: " New Name ",
      now: updatedAt,
    });

    expect(result).toEqual(Result.ok());
    expect(user.getId().getValue()).toBe("user-123");
    expect(user.toProfile()).toEqual({
      id: "user-123",
      email: "new@example.com",
      displayName: "New Name",
      createdAt,
      updatedAt,
    });
  });
});
