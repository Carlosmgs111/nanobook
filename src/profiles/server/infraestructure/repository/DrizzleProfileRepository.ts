import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import { Profile } from "../../domain/Profile";
import {
  ProfileRepositoryError,
  UsernameAlreadyTakenError,
} from "../../domain/errors";
import type { ProfileRepository } from "../../domain/ports/ProfileRepository";
import type { Username } from "../../domain/Username";
import { userProfile } from "../database/DrizzleProfileSchema";

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly database: LibSQLDatabase) {}

  async getByUserId(userId: string) {
    try {
      const [row] = await this.database.select().from(userProfile).where(eq(userProfile.userId, userId));
      return Result.ok(row ? this.toProfile(row) : null);
    } catch (error) {
      return Result.fail(new ProfileRepositoryError("No fue posible consultar el perfil", { cause: error }));
    }
  }

  async getByUsername(username: Username) {
    try {
      const [row] = await this.database.select().from(userProfile).where(eq(userProfile.username, username.getValue()));
      return Result.ok(row ? this.toProfile(row) : null);
    } catch (error) {
      return Result.fail(new ProfileRepositoryError("No fue posible consultar el perfil", { cause: error }));
    }
  }

  async create(profile: Profile) {
    try {
      await this.database.insert(userProfile).values(profile.toPersistence());
      return Result.ok();
    } catch (error) {
      if (hasUsernameUniqueConflict(error)) {
        return Result.fail(new UsernameAlreadyTakenError(profile.toPublic().username));
      }
      return Result.fail(new ProfileRepositoryError("No fue posible crear el perfil", { cause: error }));
    }
  }

  async update(profile: Profile) {
    try {
      const persisted = profile.toPersistence();
      await this.database
        .update(userProfile)
        .set({ displayName: persisted.displayName, updatedAt: persisted.updatedAt })
        .where(eq(userProfile.userId, persisted.userId));
      return Result.ok();
    } catch (error) {
      return Result.fail(new ProfileRepositoryError("No fue posible actualizar el perfil", { cause: error }));
    }
  }

  private toProfile(row: typeof userProfile.$inferSelect): Profile {
    return Profile.create({
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }).getValue();
  }
}

function hasUsernameUniqueConflict(error: unknown): boolean {
  let current = error;
  while (current instanceof Error) {
    if (current.message.includes("user_profile.username")) return true;
    current = current.cause;
  }
  return false;
}
