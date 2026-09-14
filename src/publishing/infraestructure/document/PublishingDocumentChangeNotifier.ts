import { Result } from "../../../shared/domain/Result";
import { DocumentNotificationError } from "../../../document/infraestructure/errors";
import type { DocumentChangeNotifier } from "../../../document/application/ports/DocumentChangeNotifier";
import type { PagePublisher } from "../../application/PagePublisher";

/**
 * Adaptador del módulo `publishing` que satisface el puerto
 * `DocumentChangeNotifier` del módulo `document`.
 *
 * Tras la creación o actualización de un documento, invalida la caché de
 * páginas renderizadas asociadas.
 */
export class PublishingDocumentChangeNotifier
  implements DocumentChangeNotifier
{
  constructor(private pagePublisher: PagePublisher) {}

  async onDocumentCreated(
    documentId: string
  ): Promise<Result<DocumentNotificationError, void>> {
    return this.invalidate(documentId, "creation");
  }

  async onDocumentUpdated(
    documentId: string
  ): Promise<Result<DocumentNotificationError, void>> {
    return this.invalidate(documentId, "update");
  }

  private async invalidate(
    documentId: string,
    operation: "creation" | "update"
  ): Promise<Result<DocumentNotificationError, void>> {
    try {
      const result = await this.pagePublisher.invalidate([documentId]);
      if (!result.isSuccess) {
        return Result.fail(
          new DocumentNotificationError(
            `Failed to notify document ${operation}: ${
              result.getError().message
            }`,
            { cause: result.getError() }
          )
        );
      }
      return Result.ok();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(
        new DocumentNotificationError(
          `Failed to notify document ${operation}: ${message}`,
          { cause: error }
        )
      );
    }
  }
}
