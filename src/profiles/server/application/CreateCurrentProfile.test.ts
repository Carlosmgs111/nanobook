import { describe, expect, it } from "vitest";

import { InMemoryProfileRepository } from "../infraestructure/repository/InMemoryProfileRepository";
import { CreateCurrentProfile } from "./CreateCurrentProfile";
import { ProfileAlreadyExistsError, UsernameAlreadyTakenError } from "./errors";

describe("CreateCurrentProfile", () => {
  it("creates a profile only once for the authenticated actor", async () => {
    const create = new CreateCurrentProfile(new InMemoryProfileRepository());

    expect((await create.execute("auth-user-1", { username: "Carlos", displayName: "Carlos" })).isSuccess).toBe(true);
    expect((await create.execute("auth-user-1", { username: "other", displayName: "Other" })).getError()).toBeInstanceOf(ProfileAlreadyExistsError);
  });

  it("rejects a normalized username already held by another actor", async () => {
    const create = new CreateCurrentProfile(new InMemoryProfileRepository());
    await create.execute("auth-user-1", { username: "carlos", displayName: "Carlos" });

    expect((await create.execute("auth-user-2", { username: "CARLOS", displayName: "Other" })).getError()).toBeInstanceOf(UsernameAlreadyTakenError);
  });
});
