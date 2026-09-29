import { describe, expect, it } from "vitest";
import { CreateUser } from "./CreateUser";
import { InMemoryUserRepository } from "../infraestructure/server/repository/InMemoryUserRepository";
import { UserEmailAlreadyExistsError } from "../domain/errors";

describe("CreateUser", () => {
  it("creates and returns a profile", async () => {
    const result = await new CreateUser(new InMemoryUserRepository()).execute({
      email: " USER@example.com ",
      displayName: " User ",
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toMatchObject({
      email: "user@example.com",
      displayName: "User",
    });
  });

  it("returns a duplicate email conflict", async () => {
    const repository = new InMemoryUserRepository();
    const useCase = new CreateUser(repository);
    await useCase.execute({ email: "user@example.com", displayName: "One" });

    const result = await useCase.execute({ email: " USER@EXAMPLE.COM ", displayName: "Two" });

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(UserEmailAlreadyExistsError);
  });
});
