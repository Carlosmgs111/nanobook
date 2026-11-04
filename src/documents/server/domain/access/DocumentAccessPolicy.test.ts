import { describe, expect, it } from "vitest";

import { PasswordAccessPolicy } from "./DocumentAccessPolicy";

describe("PasswordAccessPolicy", () => {
  const policy = new PasswordAccessPolicy();

  it("allows documents that are not secured", () => {
    expect(policy.evaluate({ secured: false, canWrite: false, hasValidGrant: false })).toEqual({ kind: "allow" });
  });

  it("allows writers without a grant", () => {
    expect(policy.evaluate({ secured: true, canWrite: true, hasValidGrant: false })).toEqual({ kind: "allow" });
  });

  it("allows readers holding a valid grant", () => {
    expect(policy.evaluate({ secured: true, canWrite: false, hasValidGrant: true })).toEqual({ kind: "allow" });
  });

  it("challenges everyone else with a password", () => {
    expect(policy.evaluate({ secured: true, canWrite: false, hasValidGrant: false })).toEqual({
      kind: "challenge",
      method: "password",
    });
  });
});
