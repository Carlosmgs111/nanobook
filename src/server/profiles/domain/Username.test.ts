import { describe, expect, it } from "vitest";

import { Username } from "./Username";

describe("Username", () => {
  it("normalizes a valid public username to lowercase", () => {
    const result = Username.create(" Carlos-MGS111 ");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getValue()).toBe("carlos-mgs111");
  });

  it("rejects usernames outside the public handle boundaries", () => {
    for (const value of ["ab", "-carlos", "carlos-", "carlos_mgs", "a".repeat(33)]) {
      expect(Username.create(value).isSuccess).toBe(false);
    }
  });
});
