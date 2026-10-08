import { describe, expect, it } from "vitest";

import { Profile } from "../domain/Profile";
import { InMemoryProfileRepository } from "../infraestructure/repository/InMemoryProfileRepository";
import { ProfileNotFoundError } from "./errors";
import { UpdateCurrentProfile } from "./UpdateCurrentProfile";

describe("UpdateCurrentProfile", () => {
  it("updates only the current actor public display name", async () => {
    const repository = new InMemoryProfileRepository();
    await repository.create(Profile.create({ userId: "auth-user-1", username: "carlos", displayName: "Carlos" }).getValue());
    const update = new UpdateCurrentProfile(repository);

    const result = await update.execute("auth-user-1", { displayName: "Carlos Muñoz" });

    expect(result.getValue()).toEqual({ username: "carlos", displayName: "Carlos Muñoz" });
  });

  it("reports a missing current profile", async () => {
    const update = new UpdateCurrentProfile(new InMemoryProfileRepository());

    expect((await update.execute("auth-user-1", { displayName: "Carlos" })).getError()).toBeInstanceOf(ProfileNotFoundError);
  });
});
