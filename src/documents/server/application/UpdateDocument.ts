import {
  Subject,
  type AccessCheckFailedError,
  type AccessDeniedError,
  type Authorizer,
} from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import type { EventBusError } from "../../../shared/domain/bus/errors";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { DocumentInput } from "./dto/DocumentInput";
import { DocumentUpdated } from "../domain/events/DocumentUpdated";
import {
  DocumentNotFoundError,
  DocumentAlreadyExistsError,
  InvalidDocumentIdError,
  type DocumentServiceError,
  type DocumentRepositoryError,
  type DocumentParseError,
} from "../domain/errors";
import { Document } from "../domain/Document";
import { publishAll } from "./publishAll";

export type UpdateDocumentError =
  | AccessDeniedError
  | AccessCheckFailedError
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | EventBusError;

export class UpdateDocument {
  constructor(
    private contentRepository: ContentRepository,
    private eventBus: EventBus,
    private authorizer: Authorizer,
  ) {}

  async execute(
    nanobookId: string,
    input: DocumentInput,
    actorId: string,
  ): Promise<Result<UpdateDocumentError, Document>> {
    const writable = await this.authorizer.require({
      subject: Subject.of(actorId),
      action: "write",
      resource: { type: "document", id: input.id ?? "", nanobookId },
    });
    if (!writable.isSuccess) return Result.fail(writable.getError());

    const documentId = input.id;
    if (!documentId) return Result.fail(new InvalidDocumentIdError(""));

    const found = await this.contentRepository.getById(nanobookId, documentId);
    if (!found.isSuccess) return Result.fail(found.getError());
    const existing = found.getValue();
    if (!existing) return Result.fail(new DocumentNotFoundError(documentId));

    const existingMetadata = existing.getMetadata();
    const updatedResult = Document.create(
      input.path,
      {
        title: input.title,
        description: input.description,
        cover: input.cover,
        tags: input.tags,
        draft: input.draft,
        position: input.position,
        ref: input.ref,
        // Identidad, auditoría y protección son del servidor: el cliente no las cambia.
        id: documentId,
        author: existingMetadata.author,
        ownerId: existingMetadata.ownerId,
        secured: existingMetadata.secured,
        createdAt: existingMetadata.createdAt,
        updatedAt: new Date(),
      },
      input.content,
      undefined,
      undefined,
      documentId,
      existing.getRevision(),
    );
    if (!updatedResult.isSuccess) return Result.fail(updatedResult.getError());
    const updated = updatedResult.getValue();

    const moveSet = await this.buildMoveSet(nanobookId, existing, updated);
    if (!moveSet.isSuccess) return Result.fail(moveSet.getError());
    const documents = moveSet.getValue();

    // Solo el documento editado (el primero) lleva la revisión que el cliente conocía.
    const saved = await this.contentRepository.updateMany(
      nanobookId,
      documents.map((document, index) => ({
        document,
        expectedRevision: index === 0 ? input.expectedRevision : undefined,
      })),
    );
    if (!saved.isSuccess) return Result.fail(saved.getError());

    const published = await publishAll(
      this.eventBus,
      documents.map((document) => new DocumentUpdated(document.getDocumentId().getValue(), nanobookId)),
    );
    if (!published.isSuccess) return Result.fail(published.getError());

    return documents[0].withRevision(documents[0].getRevision() + 1);
  }

  /** Renombrar un índice arrastra a todos sus descendientes; cualquier otro cambio afecta solo al documento. */
  private async buildMoveSet(
    nanobookId: string,
    existing: Document,
    updated: Document,
  ): Promise<Result<UpdateDocumentError, Document[]>> {
    const pathChanged = existing.getPath() !== updated.getPath();
    if (!pathChanged || !existing.isIndex() || !updated.isIndex()) {
      return Result.ok([updated]);
    }

    const listed = await this.contentRepository.list(nanobookId);
    if (!listed.isSuccess) return Result.fail(listed.getError());

    const oldPublicPath = existing.getPublicPath();
    const newPublicPath = updated.getPublicPath();
    const documents = listed.getValue();
    const descendants = documents.filter((document) =>
      document.getPublicPath().startsWith(`${oldPublicPath}/`),
    );

    const moveSet: Document[] = [updated];
    for (const descendant of descendants) {
      const nextPath = `${newPublicPath}${descendant.getPath().slice(oldPublicPath.length)}`;
      const moved = descendant.moveTo(nextPath);
      if (!moved.isSuccess) return Result.fail(moved.getError());
      moveSet.push(moved.getValue());
    }

    const movingIds = new Set([existing, ...descendants].map((document) => document.getDocumentId().getValue()));
    const targetPaths = new Set(moveSet.map((document) => document.getPath()));
    const collision = documents.find(
      (document) => !movingIds.has(document.getDocumentId().getValue()) && targetPaths.has(document.getPath()),
    );
    if (collision) return Result.fail(new DocumentAlreadyExistsError(collision.getPath()));

    return Result.ok(moveSet);
  }
}
