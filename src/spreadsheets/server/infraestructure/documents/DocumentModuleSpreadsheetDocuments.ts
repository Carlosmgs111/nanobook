import { AccessCheckFailedError, AccessDeniedError } from "../../../../authorization/server";
import { DocumentRevisionConflictError, type DocumentModule } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { SheetRevisionConflictError, SheetWriteError } from "../../domain/errors";
import type { SheetDocument, SheetWriteFailure, SpreadsheetDocuments } from "../../domain/ports/SpreadsheetDocuments";

/** Adaptador del puerto sobre las capacidades de lectura y escritura que ya expone `documents`. */
export class DocumentModuleSpreadsheetDocuments implements SpreadsheetDocuments {
  constructor(private readonly documents: Pick<DocumentModule, "getDocument" | "updateDocument">) {}

  async read(nanobookId: string, documentPath: string): Promise<SheetDocument | null> {
    // El documento almacenado, no el resuelto con proxies: lo que se guarda no puede contener contenido ajeno.
    const document = await this.documents.getDocument.executeRaw(nanobookId, documentPath);
    if (!document) return null;

    const metadata = document.getMetadata();
    return {
      id: document.getDocumentId().getValue(),
      path: document.getPath(),
      title: document.getTitle(),
      description: document.getDescription(),
      content: document.getContent(),
      revision: document.getRevision(),
      author: metadata.author,
      cover: metadata.cover,
      tags: metadata.tags,
      draft: metadata.draft,
      position: document.getPosition(),
      // Tal cual: aplanar un ref github/url a string lo convertiría en un ref local al guardar.
      ref: metadata.ref,
    };
  }

  async write(nanobookId: string, document: SheetDocument, actorId: string): Promise<Result<SheetWriteFailure, void>> {
    const { revision, ...fields } = document;
    const result = await this.documents.updateDocument.execute(nanobookId, { ...fields, expectedRevision: revision }, actorId);
    if (result.isSuccess) return Result.ok();

    const error = result.getError();
    if (error instanceof AccessDeniedError || error instanceof AccessCheckFailedError) return Result.fail(error);
    if (error instanceof DocumentRevisionConflictError) return Result.fail(new SheetRevisionConflictError());
    return Result.fail(new SheetWriteError(error));
  }
}
