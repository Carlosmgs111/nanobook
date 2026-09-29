import { describe, expect, it } from "vitest";
import { UserModule } from "../../../index";
import { CreateUserController } from "./CreateUserController";
import { GetUserController } from "./GetUserController";
import { GetUserByEmailController } from "./GetUserByEmailController";
import { UpdateUserController } from "./UpdateUserController";
import { DeleteUserController } from "./DeleteUserController";

function context(
  url: string,
  method: string,
  params: Record<string, string | undefined> = {},
  body?: unknown
) {
  return {
    params,
    url: new URL(url),
    request: new Request(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  } as never;
}

async function json(response: Response) {
  return await response.json();
}

describe("user input adapters", () => {
  it("creates a user and strips server-controlled fields", async () => {
    const module = await UserModule.create();
    const response = await new CreateUserController(module.createUser).handle(
      context("http://localhost/api/users", "POST", {}, {
        email: "USER@example.com",
        displayName: "User",
        id: "forged-id",
        createdAt: "forged-date",
      })
    );

    const body = await json(response);
    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      email: "user@example.com",
      displayName: "User",
    });
    expect(body.id).not.toBe("forged-id");
  });

  it("gets a user by id", async () => {
    const module = await UserModule.create();
    const created = await module.createUser.execute({
      email: "user@example.com",
      displayName: "User",
    });

    const response = await new GetUserController(module.getUser).handle(
      context(`http://localhost/api/users/${created.getValue().id}`, "GET", {
        id: created.getValue().id,
      })
    );

    expect(response.status).toBe(200);
    expect((await json(response)).id).toBe(created.getValue().id);
  });

  it("gets a user by email query", async () => {
    const module = await UserModule.create();
    await module.createUser.execute({ email: "user@example.com", displayName: "User" });

    const response = await new GetUserByEmailController(module.getUserByEmail).handle(
      context("http://localhost/api/users?email=USER%40EXAMPLE.COM", "GET")
    );

    expect(response.status).toBe(200);
    expect((await json(response)).email).toBe("user@example.com");
  });

  it("updates only mutable profile fields", async () => {
    const module = await UserModule.create();
    const created = await module.createUser.execute({
      email: "old@example.com",
      displayName: "Old",
    });

    const response = await new UpdateUserController(module.updateUser).handle(
      context(`http://localhost/api/users/${created.getValue().id}`, "PATCH", {
        id: created.getValue().id,
      }, {
        email: "new@example.com",
        displayName: "New",
        id: "forged-id",
        updatedAt: "forged-date",
      })
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      id: created.getValue().id,
      email: "new@example.com",
      displayName: "New",
    });
  });

  it("deletes a user", async () => {
    const module = await UserModule.create();
    const created = await module.createUser.execute({
      email: "user@example.com",
      displayName: "User",
    });

    const response = await new DeleteUserController(module.deleteUser).handle(
      context(`http://localhost/api/users/${created.getValue().id}`, "DELETE", {
        id: created.getValue().id,
      })
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true });
  });

  it("maps malformed input and not-found errors", async () => {
    const module = await UserModule.create();
    const createResponse = await new CreateUserController(module.createUser).handle(
      context("http://localhost/api/users", "POST", {}, { displayName: "Missing email" })
    );
    const missingResponse = await new GetUserController(module.getUser).handle(
      context("http://localhost/api/users/missing", "GET", { id: "missing" })
    );

    expect(createResponse.status).toBe(400);
    expect(missingResponse.status).toBe(404);
  });
});
