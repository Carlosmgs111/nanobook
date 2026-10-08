import { describe, expect, it } from "vitest";

import { Profile } from "../domain/Profile";
import { InMemoryProfileRepository } from "../infraestructure/repository/InMemoryProfileRepository";
import { GetCurrentProfile } from "./GetCurrentProfile";
import { ProfileNotFoundError } from "./errors";

describe("GetCurrentProfile", () => {
  it("returns the current actor public profile", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.create(Profile.create({ userId: "auth-user-1", username: "carlos", displayName: "Carlos" }).getValue());

    expect((await new GetCurrentProfile(repository).execute("auth-user-1")).getValue()).toEqual({ username: "carlos", displayName: "Carlos" });
  });

  it("reports when the actor has not created a profile", async () => {
    expect((await new GetCurrentProfile(new InMemoryProfileRepository()).execute("auth-user-1")).getError()).toBeInstanceOf(ProfileNotFoundError);
  });
});
