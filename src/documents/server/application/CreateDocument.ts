import {
  Subject,
  type AccessCheckFailedError,
  type AccessDeniedError,
  type Authorizer,
} from "../../../authorization/server";
import type { EventBus } from "../../../shared/domain/bus/EventBus";
import type { EventBusError } from "../../../shared/domain/bus/errors";
import { Result } from "../../../shared/domain/Result";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import {
  DocumentAlreadyExistsError,
  InvalidDocumentIdError,
  ParentNotFoundError,
  type DocumentServiceError,
  type DocumentRepositoryError,
  type DocumentParseError,
} from "../domain/errors";
import { DocumentCreated } from "../domain/events/DocumentCreated";
import { Document } from "../domain/Document";
import { DocumentId } from "../domain/DocumentId";
import { DocumentPath } from "../domain/DocumentPath";
import type { DocumentInput } from "./dto/DocumentInput";
import { publishAll } from "./publishAll";

export type CreateDocumentError =
  | AccessDeniedError
  | AccessCheckFailedError
  | DocumentServiceError
  | DocumentRepositoryError
  | DocumentParseError
  | EventBusError;

export class CreateDocument {
  constructor(
    private repository: ContentRepository,
    private eventBus: EventBus,
    private authorizer: Authorizer,
  ) {}

  async execute(
    nanobookId: string,
    input: DocumentInput,
    actorId: string,
  ): Promise<Result<CreateDocumentError, Document>> {
    const writable = await this.authorizer.require({
      subject: Subject.of(actorId),
      action: "write",
      resource: { type: "document", id: input.path, nanobookId },
    });
    if (!writable.isSuccess) return Result.fail(writable.getError());

    const pathResult = DocumentPath.create(input.path);
    if (!pathResult.isSuccess) return Result.fail(pathResult.getError());
    const path = pathResult.getValue();

    const existing = await this.repository.getByPath(nanobookId, path.getInternalValue());
    if (!existing.isSuccess) return Result.fail(existing.getError());
    if (existing.getValue()) {
      return Result.fail(new DocumentAlreadyExistsError(path.getInternalValue()));
    }

    const parent = await this.findParent(nanobookId, path);
    if (!parent.isSuccess) return Result.fail(parent.getError());

    // La auditoría y el dueño los fija el servidor; no pueden venir del editor.
    const now = new Date();
    const documentResult = Document.create(
      input.path,
      {
        title: input.title,
        description: input.description,
        createdAt: now,
        updatedAt: now,
        ownerId: actorId,
        author: input.author,
        position: input.position,
        draft: input.draft,
        tags: input.tags,
        cover: input.cover,
        ref: input.ref,
      },
      input.content,
      undefined,
      undefined,
      input.id ?? DocumentId.generate().getValue(),
    );
    if (!documentResult.isSuccess) return Result.fail(documentResult.getError());
    const document = documentResult.getValue();

    const created = await this.repository.create(nanobookId, document);
    if (!created.isSuccess) return Result.fail(created.getError());

    // El índice padre también cambia: su listado de hijos y su caché dependen del nuevo documento.
    const published = await publishAll(
      this.eventBus,
      [document, parent.getValue()]
        .filter((affected): affected is Document => affected !== null)
        .map((affected) => new DocumentCreated(affected.getDocumentId().getValue(), nanobookId)),
    );
    if (!published.isSuccess) return Result.fail(published.getError());

    return Result.ok(document);
  }

  /** `null` cuando el documento cuelga de la raíz; el padre de un documento siempre es un índice. */
  private async findParent(nanobookId: string, path: DocumentPath) {
    const parentPath = path.getInternalParentPath();
    if (parentPath === null) return Result.ok<Document | null>(null);

    const found = await this.repository.getByPath(nanobookId, parentPath.getInternalValue());
    if (!found.isSuccess) return Result.fail(found.getError());
    const parent = found.getValue();
    if (!parent) return Result.fail(new ParentNotFoundError(parentPath.getInternalValue()));
    if (!parent.isIndex()) return Result.fail(new InvalidDocumentIdError(parentPath.getInternalValue()));
    return Result.ok<Document | null>(parent);
  }
}
