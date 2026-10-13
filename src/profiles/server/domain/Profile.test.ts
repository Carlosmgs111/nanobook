import { describe, expect, it } from "vitest";

import { Profile } from "./Profile";

describe("Profile", () => {
  it("keeps the identity and username while changing the public display name", () => {
    const profile = Profile.create({
      userId: "auth-user-1",
      username: "carlos",
      displayName: "Carlos",
      now: new Date("2026-10-08T00:00:00.000Z"),
    }).getValue();

    const result = profile.updateDisplayName("Carlos Muñoz", new Date("2026-10-08T00:01:00.000Z"));

    expect(result.isSuccess).toBe(true);
    expect(profile.toPublic()).toEqual({ username: "carlos", displayName: "Carlos Muñoz" });
    expect(profile.getUserId()).toBe("auth-user-1");
  });

  it("rejects a blank display name without changing the public profile", () => {
    const profile = Profile.create({ userId: "auth-user-1", username: "carlos", displayName: "Carlos" }).getValue();

    const result = profile.updateDisplayName("   ");

    expect(result.isSuccess).toBe(false);
    expect(profile.toPublic()).toEqual({ username: "carlos", displayName: "Carlos" });
  });

  it("preserves persisted audit timestamps when it is rehydrated", () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-02-01T00:00:00.000Z");
    const profile = Profile.create({
      userId: "auth-user-1",
      username: "carlos",
      displayName: "Carlos",
      createdAt,
      updatedAt,
    }).getValue();

    expect(profile.toPersistence()).toMatchObject({ createdAt, updatedAt });
  });
});
