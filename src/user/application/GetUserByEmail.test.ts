import { describe, expect, it } from "vitest";
import { CreateUser } from "./CreateUser";
import { GetUserByEmail } from "./GetUserByEmail";
import { InMemoryUserRepository } from "../infraestructure/server/repository/InMemoryUserRepository";
import { UserNotFoundError } from "./errors";

describe("GetUserByEmail", () => {
  it("looks up a normalized email", async () => {
    const repository = new InMemoryUserRepository();
    const created = await new CreateUser(repository).execute({
      email: "user@example.com",
      displayName: "User",
    });

    const result = await new GetUserByEmail(repository).execute(" USER@EXAMPLE.COM ");

    expect(result.getValue()).toEqual(created.getValue());
  });

  it("returns a typed not-found error", async () => {
    const result = await new GetUserByEmail(new InMemoryUserRepository()).execute(
      "missing@example.com"
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(UserNotFoundError);
  });
});
