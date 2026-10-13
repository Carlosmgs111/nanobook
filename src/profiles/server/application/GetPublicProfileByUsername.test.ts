import { describe, expect, it } from "vitest";

import { Profile } from "../domain/Profile";
import { InMemoryProfileRepository } from "../infraestructure/repository/InMemoryProfileRepository";
import { ProfileNotFoundError } from "./errors";
import { GetPublicProfileByUsername } from "./GetPublicProfileByUsername";

describe("GetPublicProfileByUsername", () => {
  it("returns only the public projection for a normalized username", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.create(Profile.create({ userId: "auth-user-1", username: "carlos", displayName: "Carlos" }).getValue());
    const getProfile = new GetPublicProfileByUsername(repository);

    expect((await getProfile.execute("CARLOS")).getValue()).toEqual({ username: "carlos", displayName: "Carlos" });
  });

  it("reports a missing public profile", async () => {
    const getProfile = new GetPublicProfileByUsername(new InMemoryProfileRepository());

    expect((await getProfile.execute("carlos")).getError()).toBeInstanceOf(ProfileNotFoundError);
  });
});
