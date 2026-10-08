import { describe, expect, it } from "vitest";

import { CreateCurrentProfile } from "../../application/CreateCurrentProfile";
import { GetCurrentProfile } from "../../application/GetCurrentProfile";
import { GetPublicProfileByUsername } from "../../application/GetPublicProfileByUsername";
import { UpdateCurrentProfile } from "../../application/UpdateCurrentProfile";
import { InMemoryProfileRepository } from "../repository/InMemoryProfileRepository";
import { CreateCurrentProfileController } from "./CreateCurrentProfileController";
import { GetCurrentProfileController } from "./GetCurrentProfileController";
import { GetPublicProfileController } from "./GetPublicProfileController";
import { UpdateCurrentProfileController } from "./UpdateCurrentProfileController";

function context(request: Request, locals: Record<string, unknown> = {}, params: Record<string, string> = {}) {
  return { request, locals, params } as any;
}

describe("profile controllers", () => {
  it("uses the authenticated actor and ignores a forged user id in a create payload", async () => {
    const repository = new InMemoryProfileRepository();
    const controller = new CreateCurrentProfileController(new CreateCurrentProfile(repository));

    const response = await controller.handle(context(
      new Request("http://localhost/api/me/profile", {
        method: "POST",
        body: JSON.stringify({ username: "carlos", displayName: "Carlos", userId: "forged" }),
      }),
      { currentUserId: "auth-user-1" },
    ));

    expect(response.status).toBe(201);
    expect((await new GetCurrentProfile(repository).execute("auth-user-1")).getValue()).toEqual({ username: "carlos", displayName: "Carlos" });
  });

  it("maps a missing profile to 404 and a held username to 409", async () => {
    const repository = new InMemoryProfileRepository();
    const getCurrent = new GetCurrentProfileController(new GetCurrentProfile(repository));
    const create = new CreateCurrentProfileController(new CreateCurrentProfile(repository));
    await create.handle(context(new Request("http://localhost", { method: "POST", body: JSON.stringify({ username: "carlos", displayName: "Carlos" }) }), { currentUserId: "auth-user-1" }));

    const missing = await getCurrent.handle(context(new Request("http://localhost"), { currentUserId: "auth-user-2" }));
    const conflict = await create.handle(context(new Request("http://localhost", { method: "POST", body: JSON.stringify({ username: "CARLOS", displayName: "Other" }) }), { currentUserId: "auth-user-2" }));

    expect(missing.status).toBe(404);
    expect(conflict.status).toBe(409);
  });

  it("does not accept a username when updating the current profile", async () => {
    const repository = new InMemoryProfileRepository();
    await new CreateCurrentProfile(repository).execute("auth-user-1", { username: "carlos", displayName: "Carlos" });
    const controller = new UpdateCurrentProfileController(new UpdateCurrentProfile(repository));

    const response = await controller.handle(context(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ username: "other", displayName: "Carlos Muñoz" }) }), { currentUserId: "auth-user-1" }));

    expect(response.status).toBe(200);
    expect((await response.json())).toEqual({ username: "carlos", displayName: "Carlos Muñoz" });
  });

  it("returns a public profile without its actor id", async () => {
    const repository = new InMemoryProfileRepository();
    await new CreateCurrentProfile(repository).execute("auth-user-1", { username: "carlos", displayName: "Carlos" });
    const controller = new GetPublicProfileController(new GetPublicProfileByUsername(repository));

    const response = await controller.handle(context(new Request("http://localhost"), {}, { username: "carlos" }));

    expect(await response.json()).toEqual({ username: "carlos", displayName: "Carlos" });
  });
});
