import { Result } from "../../../../shared/domain/Result";
import type {
  AccessGrantCodec,
  DocumentAccessRecord,
  DocumentAccessRepository,
  PasswordHasher,
  UnlockAttemptLimiter,
  UnlockAttemptStatus,
} from "../../domain/access/ports";

export class InMemoryAccessRepository implements DocumentAccessRepository {
  readonly records = new Map<string, DocumentAccessRecord>();

  async get(documentId: string) {
    return Result.ok(this.records.get(documentId) ?? null);
  }

  async setPasswordHash(documentId: string, passwordHash: string | null) {
    const version = (this.records.get(documentId)?.passwordVersion ?? 0) + 1;
    const record = { documentId, passwordHash, passwordVersion: version };
    this.records.set(documentId, record);
    return Result.ok(record);
  }
}

export class FakeHasher implements PasswordHasher {
  async hash(password: string) {
    return `hash:${password}`;
  }
  async verify(password: string, stored: string) {
    return stored === `hash:${password}`;
  }
}

export class FakeCodec implements AccessGrantCodec {
  issue(input: { documentId: string; passwordVersion: number; now: Date; ttlSeconds: number }) {
    return {
      token: `${input.documentId}:${input.passwordVersion}`,
      expiresAt: new Date(input.now.getTime() + input.ttlSeconds * 1000),
    };
  }
  verify(token: string, input: { documentId: string; passwordVersion: number }) {
    return token === `${input.documentId}:${input.passwordVersion}`;
  }
}

export class FakeLimiter implements UnlockAttemptLimiter {
  failures = 0;
  blockedFor = 0;
  async check(): Promise<Result<never, UnlockAttemptStatus>> {
    return Result.ok({ blocked: this.blockedFor > 0, retryAfterSeconds: this.blockedFor });
  }
  async recordFailure() {
    this.failures += 1;
    return Result.ok();
  }
  async reset() {
    this.failures = 0;
    return Result.ok();
  }
}
