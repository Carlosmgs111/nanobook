import { describe, expect, it } from "vitest";
import { UserModule } from "./index";

describe("UserModule", () => {
  it("wires all use cases to one working repository", async () => {
    const module = await UserModule.create();
    const created = await module.createUser.execute({
      email: "user@example.com",
      displayName: "User",
    });

    expect(created.isSuccess).toBe(true);
    expect(
      (await module.getUser.execute(created.getValue().id)).getValue()
    ).toEqual(created.getValue());
    expect(
      (await module.getUserByEmail.execute("USER@EXAMPLE.COM")).getValue()
    ).toEqual(created.getValue());
  });
});
