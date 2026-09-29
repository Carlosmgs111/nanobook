import { describe, expect, it } from "vitest";
import { CreateUser } from "./CreateUser";
import { DeleteUser } from "./DeleteUser";
import { GetUser } from "./GetUser";
import { InMemoryUserRepository } from "../infraestructure/outbound/repository/InMemoryUserRepository";
import { UserNotFoundError } from "./errors";

describe("DeleteUser", () => {
  it("deletes an existing user", async () => {
    const repository = new InMemoryUserRepository();
    const created = await new CreateUser(repository).execute({
      email: "user@example.com",
      displayName: "User",
    });

    const result = await new DeleteUser(repository).execute(created.getValue().id);

    expect(result.isSuccess).toBe(true);
    expect((await new GetUser(repository).execute(created.getValue().id)).isSuccess).toBe(false);
  });

  it("returns a typed not-found error", async () => {
    const result = await new DeleteUser(new InMemoryUserRepository()).execute("missing");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(UserNotFoundError);
  });
});
