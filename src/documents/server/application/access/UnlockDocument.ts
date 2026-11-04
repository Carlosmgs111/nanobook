import { Result } from "../../../../shared/domain/Result";
import type { AccessGrantPolicy } from "../../domain/access/AccessGrantPolicy";
import type {
  AccessGrantCodec,
  DocumentAccessRepository,
  PasswordHasher,
  UnlockAttemptLimiter,
} from "../../domain/access/ports";
import {
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
  type DocumentRepositoryError,
} from "../../domain/errors";
import type { GetDocument } from "../GetDocument";
import { securedDocuments } from "./AuthorizeDocumentAccess";

export interface UnlockDocumentInput {
  nanobookId: string;
  documentPath: string;
  password: string;
  /** Stable, privacy-preserving identifier of the caller used for rate limiting. */
  clientKey: string;
}

export interface UnlockGrant {
  cookieName: string;
  token: string;
  maxAgeSeconds: number;
}

export type UnlockDocumentError =
  | DocumentNotFoundError
  | DocumentUnlockFailedError
  | DocumentUnlockRateLimitedError
  | DocumentRepositoryError;

export class UnlockDocument {
  constructor(
    private readonly getDocument: Pick<GetDocument, "execute" | "executeRaw">,
    private readonly accessRepository: DocumentAccessRepository,
    private readonly hasher: PasswordHasher,
    private readonly limiter: UnlockAttemptLimiter,
    private readonly codec: AccessGrantCodec,
    private readonly policy: AccessGrantPolicy,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: UnlockDocumentInput): Promise<Result<UnlockDocumentError, UnlockGrant>> {
    const raw = await this.getDocument.executeRaw(input.nanobookId, input.documentPath);
    const resolved = await this.getDocument.execute(input.nanobookId, input.documentPath);
    const chain = securedDocuments([raw, resolved]);
    if (chain.length === 0) return Result.fail(new DocumentNotFoundError(input.documentPath));

    const now = this.clock();
    // Attempts are counted against the requested document, not the chain link.
    const limiterId = (raw ?? resolved)!.getDocumentId().getValue();

    const status = await this.limiter.check(limiterId, input.clientKey, now);
    if (!status.isSuccess) return Result.fail(status.getError());
    if (status.getValue().blocked) {
      return Result.fail(new DocumentUnlockRateLimitedError(status.getValue().retryAfterSeconds));
    }

    for (const document of chain) {
      const documentId = document.getDocumentId().getValue();
      const stored = await this.accessRepository.get(documentId);
      if (!stored.isSuccess) return Result.fail(stored.getError());
      const record = stored.getValue();
      if (!record || record.passwordHash === null) continue;

      if (await this.hasher.verify(input.password, record.passwordHash)) {
        await this.limiter.reset(limiterId, input.clientKey);
        const grant = this.codec.issue({
          documentId,
          passwordVersion: record.passwordVersion,
          now,
          ttlSeconds: this.policy.ttlSeconds,
        });
        return Result.ok({
          cookieName: this.codec.cookieName(documentId),
          token: grant.token,
          maxAgeSeconds: this.policy.ttlSeconds,
        });
      }
    }

    const recorded = await this.limiter.recordFailure(limiterId, input.clientKey, now);
    if (!recorded.isSuccess) return Result.fail(recorded.getError());
    return Result.fail(new DocumentUnlockFailedError());
  }
}
