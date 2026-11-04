import { Result } from "../../../../shared/domain/Result";
import type { EventBus } from "../../../../shared/domain/bus/EventBus";
import type { EventBusError } from "../../../../shared/domain/bus/errors";
import type { DocumentAccessRepository, PasswordHasher } from "../../domain/access/ports";
import {
  InvalidDocumentPasswordError,
  type DocumentRepositoryError,
  type InvalidDocumentError,
  type InvalidDocumentIdError,
} from "../../domain/errors";
import { DocumentUpdated } from "../../domain/events/DocumentUpdated";
import type { ContentRepository, ContentRepositoryError } from "../../domain/ports/ContentRepository";
import { loadOwnedDocument, type LoadOwnedDocumentError } from "./loadOwnedDocument";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export type DocumentAccessAdminError =
  | LoadOwnedDocumentError
  | InvalidDocumentPasswordError
  | DocumentRepositoryError
  | ContentRepositoryError
  | InvalidDocumentIdError
  | InvalidDocumentError
  | EventBusError;

export class SetDocumentPassword {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly accessRepository: DocumentAccessRepository,
    private readonly hasher: PasswordHasher,
    private readonly eventBus: EventBus,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    nanobookId: string,
    documentPath: string,
    password: string,
    actorId: string,
  ): Promise<Result<DocumentAccessAdminError, void>> {
    if (
      password.trim().length === 0 ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return Result.fail(
        new InvalidDocumentPasswordError(
          `La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres`,
        ),
      );
    }

    const loaded = await loadOwnedDocument(this.contentRepository, nanobookId, documentPath, actorId);
    if (!loaded.isSuccess) return Result.fail(loaded.getError());
    const document = loaded.getValue();
    const documentId = document.getDocumentId().getValue();
    const now = this.clock();

    const stored = await this.accessRepository.setPasswordHash(documentId, await this.hasher.hash(password), now);
    if (!stored.isSuccess) return Result.fail(stored.getError());

    const secured = document.withSecured(true, now);
    if (!secured.isSuccess) return Result.fail(secured.getError());
    const updated = await this.contentRepository.updateMany(nanobookId, [
      { document: secured.getValue(), expectedRevision: document.getRevision() },
    ]);
    if (!updated.isSuccess) return Result.fail(updated.getError());

    const published = await this.eventBus.publish(new DocumentUpdated(documentId, nanobookId));
    if (!published.isSuccess) return Result.fail(published.getError());
    return Result.ok();
  }
}
