import { Result } from "../../../../shared/domain/Result";
import { normalizeEmail, User } from "../../../domain/User";
import type { UserId } from "../../../domain/UserId";
import type { UserRepository } from "../../../domain/ports/UserRepository";
import {
  UserEmailAlreadyExistsError,
} from "../../errors";
import type { UserRepositoryResultError } from "../../../domain/ports/UserRepository";

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private readonly emailIndex = new Map<string, string>();

  async getById(id: UserId): Promise<Result<UserRepositoryResultError, User | null>> {
    return Result.ok(this.users.get(id.getValue()) ?? null);
  }

  async getByEmail(email: string): Promise<Result<UserRepositoryResultError, User | null>> {
    const userId = this.emailIndex.get(normalizeEmail(email));
    return Result.ok(userId ? this.users.get(userId) ?? null : null);
  }

  async create(user: User): Promise<Result<UserRepositoryResultError, void>> {
    const profile = user.toProfile();
    if (this.users.has(profile.id)) {
      return Result.fail(new UserEmailAlreadyExistsError(profile.id));
    }
    const existingId = this.emailIndex.get(profile.email);
    if (existingId) {
      return Result.fail(new UserEmailAlreadyExistsError(profile.email));
    }
    this.users.set(profile.id, user);
    this.emailIndex.set(profile.email, profile.id);
    return Result.ok();
  }

  async update(user: User): Promise<Result<UserRepositoryResultError, void>> {
    const profile = user.toProfile();
    if (!this.users.has(profile.id)) {
      return Result.ok();
    }
    const existingId = this.emailIndex.get(profile.email);
    if (existingId && existingId !== profile.id) {
      return Result.fail(new UserEmailAlreadyExistsError(profile.email));
    }
    const previous = this.users.get(profile.id);
    if (previous) this.emailIndex.delete(previous.toProfile().email);
    this.users.set(profile.id, user);
    this.emailIndex.set(profile.email, profile.id);
    return Result.ok();
  }

  async delete(id: UserId): Promise<Result<UserRepositoryResultError, void>> {
    const user = this.users.get(id.getValue());
    if (!user) return Result.ok();
    this.emailIndex.delete(user.toProfile().email);
    this.users.delete(id.getValue());
    return Result.ok();
  }
}
