import { Result } from "../../../shared/domain/Result";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { DocumentInput } from "./dto/DocumentInput";
import { DocumentUpdated } from "../domain/events/DocumentUpdated";
import {
  DocumentNotFoundError,
  DocumentAlreadyExistsError,
  DocumentRepositoryError,
  DocumentParseError,
  DocumentAccessDeniedError,
  InvalidDocumentIdError,
  type DocumentServiceError,
} from "../domain/errors";
import { Document } from "../domain/Document";
import type { EventBusError } from "../../../shared/domain/bus/errors";

export type UpdateDocumentError =
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | EventBusError;

export class UpdateDocument {
  constructor(
    private contentRepository: ContentRepository,
    private eventBus: EventBus
  ) {}

  async execute(
    documentDelta: DocumentInput,
    actorId: string,
  ): Promise<Result<UpdateDocumentError, Document>> {
    const documentId = documentDelta.id;
    if (!documentId) {
      return Result.fail(new InvalidDocumentIdError(documentId ?? ""));
    }

    const documentResult = await this.contentRepository.getById(documentId);
    if (!documentResult.isSuccess) {
      return Result.fail(documentResult.getError());
    }

    const existingDocument = documentResult.getValue();
    if (!existingDocument) {
      return Result.fail(new DocumentNotFoundError(documentId));
    }
    if (existingDocument.getMetadata().ownerId !== actorId) {
      return Result.fail(new DocumentAccessDeniedError(documentId));
    }

    const { id, expectedRevision, path, content, ...rest } = documentDelta;
    const existingMetadata = existingDocument.getMetadata();

    const updatedDocumentResult = Document.create(
      path,
      {
        ...rest,
        // Identity and audit metadata are owned by the existing entity.
        id: existingDocument.getDocumentId().getValue(),
        author: existingMetadata.author,
        ownerId: existingMetadata.ownerId,
        createdAt: existingMetadata.createdAt,
        updatedAt: new Date(),
      },
      content,
      undefined,
      undefined,
      documentId,
      existingDocument.getRevision(),
    );
    if (!updatedDocumentResult.isSuccess) {
      return Result.fail(updatedDocumentResult.getError());
    }
    const updatedDocument = updatedDocumentResult.getValue();

    const documentsToUpdate = await this.buildMoveSet(
      existingDocument,
      updatedDocument
    );
    if (!documentsToUpdate.isSuccess) return Result.fail(documentsToUpdate.getError());

    const unauthorizedDocument = documentsToUpdate
      .getValue()
      .map(({ document }) => document)
      .find((document) => document.getMetadata().ownerId !== actorId);
    if (unauthorizedDocument) {
      return Result.fail(
        new DocumentAccessDeniedError(
          unauthorizedDocument.getDocumentId().getValue()
        )
      );
    }

    for (const [index, item] of documentsToUpdate.getValue().entries()) {
      const previousPath = item.previousPath && item.previousPath !== item.document.getPath()
        ? item.previousPath
        : undefined;
      const updateResult = expectedRevision !== undefined && index === 0 && this.contentRepository.updateWithRevision
        ? await this.contentRepository.updateWithRevision(item.document, expectedRevision, previousPath)
        : await this.contentRepository.update(
            item.document,
            ...(previousPath ? [previousPath] : []),
          );
      if (!updateResult.isSuccess) return Result.fail(updateResult.getError());
    }

    for (const item of documentsToUpdate.getValue()) {
      const eventResult = await this.eventBus.publish(
        new DocumentUpdated(item.document.getDocumentId().getValue())
      );
      if (!eventResult.isSuccess) return Result.fail(eventResult.getError());
    }

    const persistedResult = documentsToUpdate.getValue()[0].document.withRevision(
      documentsToUpdate.getValue()[0].document.getRevision() + 1,
    );
    if (!persistedResult.isSuccess) return Result.fail(persistedResult.getError());
    return Result.ok(persistedResult.getValue());
  }

  private async buildMoveSet(
    existingDocument: Document,
    updatedDocument: Document
  ): Promise<Result<UpdateDocumentError, Array<{ document: Document; previousPath?: string }>>> {
    const rootChanged = existingDocument.getPath() !== updatedDocument.getPath();
    if (!rootChanged || !existingDocument.isIndex() || !updatedDocument.isIndex()) {
      return Result.ok([
        { document: updatedDocument, previousPath: existingDocument.getPath() },
      ]);
    }

    const documentsResult = await this.contentRepository.list();
    if (!documentsResult.isSuccess) return Result.fail(documentsResult.getError());

    const oldPublicPath = existingDocument.getPublicPath();
    const newPublicPath = updatedDocument.getPublicPath();
    const documents = documentsResult.getValue();
    const descendants = documents.filter((document) =>
      document.getPublicPath().startsWith(`${oldPublicPath}/`)
    );
    const movingIds = new Set([
      existingDocument.getDocumentId().getValue(),
      ...descendants.map((document) => document.getDocumentId().getValue()),
    ]);
    const targetPaths = new Set<string>([updatedDocument.getPath()]);
    const moveSet: Array<{ document: Document; previousPath: string }> = [
      { document: updatedDocument, previousPath: existingDocument.getPath() },
    ];

    for (const descendant of descendants) {
      const nextPath = `${newPublicPath}${descendant.getPath().slice(oldPublicPath.length)}`;
      const movedResult = descendant.moveTo(nextPath);
      if (!movedResult.isSuccess) return Result.fail(movedResult.getError());
      const moved = movedResult.getValue();
      targetPaths.add(moved.getPath());
      moveSet.push({ document: moved, previousPath: descendant.getPath() });
    }

    const collision = documents.find(
      (document) =>
        !movingIds.has(document.getDocumentId().getValue()) &&
        targetPaths.has(document.getPath())
    );
    if (collision) {
      return Result.fail(new DocumentAlreadyExistsError(collision.getPath()));
    }

    return Result.ok(moveSet);
  }
}
