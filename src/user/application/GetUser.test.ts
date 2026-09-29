import { describe, expect, it } from "vitest";
import { CreateUser } from "./CreateUser";
import { GetUser } from "./GetUser";
import { InMemoryUserRepository } from "../infraestructure/outbound/repository/InMemoryUserRepository";
import { UserNotFoundError } from "./errors";

describe("GetUser", () => {
  it("gets a user by stable id", async () => {
    const repository = new InMemoryUserRepository();
    const created = await new CreateUser(repository).execute({
      email: "user@example.com",
      displayName: "User",
    });

    const result = await new GetUser(repository).execute(created.getValue().id);

    expect(result.getValue()).toEqual(created.getValue());
  });

  it("returns a typed not-found error", async () => {
    const result = await new GetUser(new InMemoryUserRepository()).execute("missing");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(UserNotFoundError);
  });
});
