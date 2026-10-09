import { createClient, type Client } from "@libsql/client";

import { Username } from "../src/server/profiles/domain/Username";

export interface ChangeProfileUsernameInput {
  email: string;
  expectedUsername: string;
  username: string;
}

export interface ChangeProfileUsernameResult {
  email: string;
  previousUsername: string;
  username: string;
}

export async function changeProfileUsername(
  client: Client,
  input: ChangeProfileUsernameInput,
): Promise<ChangeProfileUsernameResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const expectedUsername = normalizeUsername(input.expectedUsername);
  const username = normalizeUsername(input.username);
  const result = await client.execute({
    sql: `SELECT u.id AS user_id, u.email, p.username
          FROM user AS u
          INNER JOIN user_profile AS p ON p.user_id = u.id
          WHERE lower(u.email) = ?`,
    args: [email],
  });
  const profile = result.rows[0];
  if (!profile) throw new Error(`No profile was found for "${email}"`);

  const currentUsername = String(profile.username);
  if (currentUsername !== expectedUsername) {
    throw new Error(
      `Profile for "${email}" expected "${expectedUsername}" but found "${currentUsername}"`,
    );
  }

  if (currentUsername === username) {
    return { email: String(profile.email), previousUsername: currentUsername, username };
  }

  const existing = await client.execute({
    sql: "SELECT user_id FROM user_profile WHERE username = ? AND user_id <> ?",
    args: [username, String(profile.user_id)],
  });
  if (existing.rows.length > 0) throw new Error(`Username "${username}" is already in use`);

  try {
    await client.execute({
      sql: "UPDATE user_profile SET username = ?, updated_at = ? WHERE user_id = ? AND username = ?",
      args: [username, Date.now(), String(profile.user_id), currentUsername],
    });
  } catch (error) {
    if (isUsernameConflict(error)) throw new Error(`Username "${username}" is already in use`);
    throw error;
  }

  return { email: String(profile.email), previousUsername: currentUsername, username };
}

function normalizeUsername(value: string): string {
  const result = Username.create(value);
  if (!result.isSuccess) throw result.getError();
  return result.getValue().getValue();
}

function isUsernameConflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes("user_profile.username");
}

async function main(): Promise<void> {
  const input = {
    email: requiredArgument("--email"),
    expectedUsername: requiredArgument("--expected-username"),
    username: requiredArgument("--username"),
  };
  const client = createClient({
    url: argument("--database-url") ?? "file:./data/nanobook.db",
  });

  try {
    const result = await changeProfileUsername(client, input);
    console.log(`Updated ${result.email}: ${result.previousUsername} -> ${result.username}`);
  } finally {
    client.close();
  }
}

function argument(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArgument(flag: string): string {
  const value = argument(flag);
  if (!value) throw new Error(`Use ${flag} <value>`);
  return value;
}

if (process.argv[1]?.endsWith("change-profile-username.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
