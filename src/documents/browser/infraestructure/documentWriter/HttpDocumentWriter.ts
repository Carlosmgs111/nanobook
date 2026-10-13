import { Result } from "../../../../shared/domain/Result";
import type { DocumentWriter } from "../../application/ports/DocumentWriter";
import type {
  SerializedEntry,
  CreateDocumentRequest,
  UpdateDocumentRequest,
} from "../../../server";
import { EditionWriterError } from "../../domain/errors";

function documentApiUrl(identifier: string): string {
  const path = identifier
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/api/me/documents/${path}`;
}

function toUpdateDocumentRequest(
  document: SerializedEntry
): UpdateDocumentRequest {
  return {
    ...(typeof document.revision === "number"
      ? { expectedRevision: document.revision }
      : {}),
    path: document.path,
    title: document.title,
    description: document.description,
    content: document.content,
    cover: document.metadata.cover,
    tags: document.metadata.tags,
    draft: document.metadata.draft,
    nanobook: document.metadata.nanobook,
    position: document.metadata.position,
    ref: document.metadata.ref,
  };
}

export class HttpDocumentWriter implements DocumentWriter {
  async createDocument(
    document: CreateDocumentRequest
  ): Promise<Result<EditionWriterError, SerializedEntry>> {
    try {
      const response = await fetch(documentApiUrl(document.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(document),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return Result.fail(
          new EditionWriterError(payload.error || "Error al crear el documento")
        );
      }

      return Result.ok(await response.json());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new EditionWriterError(message, { cause: error }));
    }
  }

  async updateDocument(
    documentId: string,
    document: SerializedEntry
  ): Promise<Result<EditionWriterError, SerializedEntry>> {
    try {
      const response = await fetch(documentApiUrl(documentId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toUpdateDocumentRequest(document)),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return Result.fail(
          new EditionWriterError(payload.error || "Error al actualizar")
        );
      }

      return Result.ok(await response.json());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new EditionWriterError(message, { cause: error }));
    }
  }

  async deleteDocument(
    documentId: string
  ): Promise<Result<EditionWriterError, void>> {
    try {
      const response = await fetch(documentApiUrl(documentId), {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        return Result.fail(new EditionWriterError(payload.error || "Error al eliminar"));
      }
      return Result.ok();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new EditionWriterError(message, { cause: error }));
    }
  }
}
