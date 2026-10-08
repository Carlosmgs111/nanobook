import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Profile } from "../../domain/Profile";
import { Username } from "../../domain/Username";
import { UsernameAlreadyTakenError } from "../../domain/errors";
import { DrizzleProfileRepository } from "./DrizzleProfileRepository";

describe("DrizzleProfileRepository", () => {
  let client: ReturnType<typeof createClient>;
  let repository: DrizzleProfileRepository;

  beforeEach(async () => {
    client = createClient({ url: "file::memory:" });
    const database = drizzle(client);
    await database.run(sql`CREATE TABLE user (id TEXT PRIMARY KEY)`);
    await database.run(sql`CREATE TABLE user_profile (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    await database.run(sql`INSERT INTO user (id) VALUES ('auth-user-1'), ('auth-user-2')`);
    repository = new DrizzleProfileRepository(database);
  });

  afterEach(() => client.close());

  it("maps a normalized username conflict to UsernameAlreadyTakenError", async () => {
    await repository.create(Profile.create({ userId: "auth-user-1", username: "carlos", displayName: "Carlos" }).getValue());

    const result = await repository.create(Profile.create({ userId: "auth-user-2", username: "CARLOS", displayName: "Other" }).getValue());

    expect(result.getError()).toBeInstanceOf(UsernameAlreadyTakenError);
  });

  it("rehydrates a persisted profile by its public username", async () => {
    await repository.create(Profile.create({ userId: "auth-user-1", username: "carlos", displayName: "Carlos" }).getValue());

    const profile = await repository.getByUsername(Username.create("CARLOS").getValue());

    expect(profile.getValue()?.toPublic()).toEqual({ username: "carlos", displayName: "Carlos" });
  });
});
