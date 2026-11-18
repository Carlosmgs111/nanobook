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
import { securedDocuments } from "./documentResource";

export interface UnlockDocumentInput {
  nanobookId: string;
  documentPath: string;
  password: string;
  /** Identificador estable y privado del llamador, para limitar intentos. */
  clientKey: string;
}

export interface UnlockGrant {
  documentId: string;
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
    private readonly getDocument: Pick<GetDocument, "executeChain">,
    private readonly accessRepository: DocumentAccessRepository,
    private readonly hasher: PasswordHasher,
    private readonly limiter: UnlockAttemptLimiter,
    private readonly codec: AccessGrantCodec,
    private readonly policy: AccessGrantPolicy,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(input: UnlockDocumentInput): Promise<Result<UnlockDocumentError, UnlockGrant>> {
    const found = await this.getDocument.executeChain(input.nanobookId, input.documentPath);
    const chain = securedDocuments(found ? [found.raw, found.resolved] : []);
    if (!found || chain.length === 0) return Result.fail(new DocumentNotFoundError(input.documentPath));

    const now = this.clock();
    // Los intentos se cuentan contra el documento pedido, no contra el eslabón.
    const limiterId = found.raw.getDocumentId().getValue();

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
        const token = this.codec.issue({
          documentId,
          passwordVersion: record.passwordVersion,
          now,
          ttlSeconds: this.policy.ttlSeconds,
        });
        return Result.ok({
          documentId,
          token,
          maxAgeSeconds: this.policy.ttlSeconds,
        });
      }
    }

    const recorded = await this.limiter.recordFailure(limiterId, input.clientKey, now);
    if (!recorded.isSuccess) return Result.fail(recorded.getError());
    return Result.fail(new DocumentUnlockFailedError());
  }
}
