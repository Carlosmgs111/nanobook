import type { Result } from "../../../shared/domain/Result";
import type { DocumentNotificationError } from "../../infraestructure/errors";

export interface DocumentChangeNotifier {
  onDocumentCreated(
    documentId: string
  ): Promise<Result<DocumentNotificationError, void>>;
  onDocumentUpdated(
    documentId: string
  ): Promise<Result<DocumentNotificationError, void>>;
}
