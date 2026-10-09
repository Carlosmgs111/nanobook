import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";

import { changeProfileUsername } from "./change-profile-username";

const clients: Array<ReturnType<typeof createClient>> = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("changeProfileUsername", () => {
  it("changes the username of the profile belonging to the supplied email", async () => {
    const client = await createDatabase();

    const result = await changeProfileUsername(client, {
      email: "s111carlosmg@outlook.com",
      expectedUsername: "carlosmgs111",
      username: "s111carlosmg",
    });

    expect(result).toEqual({
      email: "s111carlosmg@outlook.com",
      previousUsername: "carlosmgs111",
      username: "s111carlosmg",
    });
    expect(
      await client.execute("SELECT username FROM user_profile WHERE user_id = 'user-1'"),
    ).toMatchObject({ rows: [{ username: "s111carlosmg" }] });
  });

  it("refuses to change a profile when its current username differs from the expected one", async () => {
    const client = await createDatabase();

    await expect(
      changeProfileUsername(client, {
        email: "s111carlosmg@outlook.com",
        expectedUsername: "another-profile",
        username: "s111carlosmg",
      }),
    ).rejects.toThrow('expected "another-profile" but found "carlosmgs111"');
  });

  it("refuses an already used destination username", async () => {
    const client = await createDatabase();
    await client.execute({
      sql: "INSERT INTO user (id, email) VALUES (?, ?)",
      args: ["user-2", "other@example.com"],
    });
    await client.execute({
      sql: "INSERT INTO user_profile (user_id, username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      args: ["user-2", "s111carlosmg", "Other user", 0, 0],
    });

    await expect(
      changeProfileUsername(client, {
        email: "s111carlosmg@outlook.com",
        expectedUsername: "carlosmgs111",
        username: "s111carlosmg",
      }),
    ).rejects.toThrow('Username "s111carlosmg" is already in use');
  });
});

async function createDatabase() {
  const client = createClient({ url: "file::memory:" });
  clients.push(client);
  await client.execute("CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE)");
  await client.execute("CREATE TABLE user_profile (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)");
  await client.execute({
    sql: "INSERT INTO user (id, email) VALUES (?, ?)",
    args: ["user-1", "s111carlosmg@outlook.com"],
  });
  await client.execute({
    sql: "INSERT INTO user_profile (user_id, username, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    args: ["user-1", "carlosmgs111", "Carlos Muñoz", 0, 0],
  });
  return client;
}
