import { describe, expect, it } from "vitest";
import { User } from "../../../domain/User";
import { UserEmailAlreadyExistsError } from "../../errors";
import { InMemoryUserRepository } from "./InMemoryUserRepository";

const makeUser = (id: string, email: string, displayName = "User") =>
  User.create({ id, email, displayName }).getValue();

describe("InMemoryUserRepository", () => {
  it("creates, reads, updates and deletes by stable identity", async () => {
    const repository = new InMemoryUserRepository();
    const user = makeUser("user-1", "user@example.com");

    expect((await repository.create(user)).isSuccess).toBe(true);
    expect((await repository.getById(user.getId())).getValue()).toBe(user);
    expect((await repository.update(user)).isSuccess).toBe(true);
    expect((await repository.delete(user.getId())).isSuccess).toBe(true);
    expect((await repository.getById(user.getId())).getValue()).toBeNull();
  });

  it("finds users by normalized email", async () => {
    const repository = new InMemoryUserRepository();
    const user = makeUser("user-1", "user@example.com");
    await repository.create(user);

    expect((await repository.getByEmail(" USER@EXAMPLE.COM ")).getValue()).toBe(user);
  });

  it("rejects duplicate normalized emails", async () => {
    const repository = new InMemoryUserRepository();
    await repository.create(makeUser("user-1", "user@example.com"));

    const result = await repository.create(makeUser("user-2", " USER@EXAMPLE.COM "));

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(UserEmailAlreadyExistsError);
  });

  it("allows an update to keep its email and rejects collisions", async () => {
    const repository = new InMemoryUserRepository();
    const first = makeUser("user-1", "first@example.com");
    const second = makeUser("user-2", "second@example.com");
    await repository.create(first);
    await repository.create(second);

    const result = await repository.update(
      User.create({
        id: "user-1",
        email: " SECOND@example.com ",
        displayName: "First",
      }).getValue()
    );

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(UserEmailAlreadyExistsError);
    expect((await repository.getByEmail("first@example.com")).getValue()).toBe(first);
  });

  it("removes the previous email index after a successful email change", async () => {
    const repository = new InMemoryUserRepository();
    const user = makeUser("user-1", "old@example.com");
    await repository.create(user);
    const replacement = User.create({
      id: "user-1",
      email: "new@example.com",
      displayName: "User",
    }).getValue();

    await repository.update(replacement);

    expect((await repository.getByEmail("old@example.com")).getValue()).toBeNull();
    expect((await repository.getByEmail("new@example.com")).getValue()).toBe(replacement);
  });

  it("returns null for missing records", async () => {
    const repository = new InMemoryUserRepository();
    const result = await repository.getById(
      User.create({ id: "missing", email: "missing@example.com", displayName: "Missing" })
        .getValue()
        .getId()
    );

    expect(result.getValue()).toBeNull();
  });
});
