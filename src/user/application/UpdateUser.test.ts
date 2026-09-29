import { describe, expect, it } from "vitest";
import { CreateUser } from "./CreateUser";
import { GetUser } from "./GetUser";
import { UpdateUser } from "./UpdateUser";
import { InMemoryUserRepository } from "../infraestructure/repository/InMemoryUserRepository";
import { UserNotFoundError } from "./errors";
import { UserEmailAlreadyExistsError } from "../domain/errors";

describe("UpdateUser", () => {
  it("updates profile fields while preserving identity and creation time", async () => {
    const repository = new InMemoryUserRepository();
    const created = await new CreateUser(repository).execute({
      email: "old@example.com",
      displayName: "Old",
      now: new Date("2026-09-29T10:00:00.000Z"),
    });

    const result = await new UpdateUser(repository).execute(created.getValue().id, {
      email: " NEW@example.com ",
      displayName: " New ",
      now: new Date("2026-09-29T11:00:00.000Z"),
    });

    expect(result.getValue()).toEqual({
      ...created.getValue(),
      email: "new@example.com",
      displayName: "New",
      updatedAt: new Date("2026-09-29T11:00:00.000Z"),
    });
  });

  it("rejects an update for a missing user", async () => {
    const result = await new UpdateUser(new InMemoryUserRepository()).execute("missing", {
      displayName: "Missing",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(UserNotFoundError);
  });

  it("does not mutate the stored user when the new email conflicts", async () => {
    const repository = new InMemoryUserRepository();
    const first = await new CreateUser(repository).execute({
      email: "first@example.com",
      displayName: "First",
    });
    await new CreateUser(repository).execute({
      email: "second@example.com",
      displayName: "Second",
    });

    const result = await new UpdateUser(repository).execute(first.getValue().id, {
      email: "second@example.com",
    });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(UserEmailAlreadyExistsError);
    expect((await new GetUser(repository).execute(first.getValue().id)).getValue().email)
      .toBe("first@example.com");
  });
});
