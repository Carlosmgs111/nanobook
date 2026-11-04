import type { Result } from "../../../../shared/domain/Result";
import type { DocumentRepositoryError } from "../errors";

export interface DocumentAccessRecord {
  documentId: string;
  /** Null once the protection was removed: nobody can unlock until a new password is set. */
  passwordHash: string | null;
  /** Monotonic; bumped on every set or clear so previous grants stop working. */
  passwordVersion: number;
}

export interface DocumentAccessRepository {
  get(documentId: string): Promise<Result<DocumentRepositoryError, DocumentAccessRecord | null>>;
  /** Upserts the hash (or null) and increments the version. */
  setPasswordHash(
    documentId: string,
    passwordHash: string | null,
    at: Date,
  ): Promise<Result<DocumentRepositoryError, DocumentAccessRecord>>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

export interface IssuedGrant {
  token: string;
  expiresAt: Date;
}

export interface AccessGrantCodec {
  cookieName(documentId: string): string;
  issue(input: {
    documentId: string;
    passwordVersion: number;
    now: Date;
    ttlSeconds: number;
  }): IssuedGrant;
  verify(
    token: string,
    input: { documentId: string; passwordVersion: number; now: Date },
  ): boolean;
}

export interface UnlockAttemptStatus {
  blocked: boolean;
  retryAfterSeconds: number;
}

export interface UnlockAttemptLimiter {
  check(
    documentId: string,
    clientKey: string,
    now: Date,
  ): Promise<Result<DocumentRepositoryError, UnlockAttemptStatus>>;
  recordFailure(
    documentId: string,
    clientKey: string,
    now: Date,
  ): Promise<Result<DocumentRepositoryError, void>>;
  reset(documentId: string, clientKey: string): Promise<Result<DocumentRepositoryError, void>>;
}
