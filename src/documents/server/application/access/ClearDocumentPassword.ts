import type { Authorizer } from "../../../../authorization/server";
import { Result } from "../../../../shared/domain/Result";
import type { EventBus } from "../../../../shared/domain/bus/EventBus";
import type { DocumentAccessRepository } from "../../domain/access/ports";
import { DocumentUpdated } from "../../domain/events/DocumentUpdated";
import type { ContentRepository } from "../../domain/ports/ContentRepository";
import { loadWritableDocument } from "./loadWritableDocument";
import type { DocumentAccessAdminError } from "./SetDocumentPassword";

export class ClearDocumentPassword {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly accessRepository: DocumentAccessRepository,
    private readonly eventBus: EventBus,
    private readonly authorizer: Authorizer,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    nanobookId: string,
    documentPath: string,
    actorId: string,
  ): Promise<Result<DocumentAccessAdminError, void>> {
    const loaded = await loadWritableDocument(this.authorizer, this.contentRepository, nanobookId, documentPath, actorId);
    if (!loaded.isSuccess) return Result.fail(loaded.getError());
    const document = loaded.getValue();
    if (document.getMetadata().secured !== true) return Result.ok();

    const documentId = document.getDocumentId().getValue();
    const now = this.clock();

    // Sube la versión primero: revoca cualquier grant anterior.
    const cleared = await this.accessRepository.setPasswordHash(documentId, null, now);
    if (!cleared.isSuccess) return Result.fail(cleared.getError());

    const open = document.withSecured(false, now);
    if (!open.isSuccess) return Result.fail(open.getError());
    const updated = await this.contentRepository.updateMany(nanobookId, [
      { document: open.getValue(), expectedRevision: document.getRevision() },
    ]);
    if (!updated.isSuccess) return Result.fail(updated.getError());

    const published = await this.eventBus.publish(new DocumentUpdated(documentId, nanobookId));
    if (!published.isSuccess) return Result.fail(published.getError());
    return Result.ok();
  }
}
