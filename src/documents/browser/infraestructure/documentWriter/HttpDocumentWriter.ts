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

  const nanobookId = typeof document !== "undefined"
    ? document.querySelector<HTMLElement>("[data-nanobook-id]")?.dataset.nanobookId
    : undefined;
  return nanobookId
    ? `/api/nanobooks/${encodeURIComponent(nanobookId)}/documents/${path}`
    : `/api/me/documents/${path}`;
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
    position: document.metadata.position,
    ref: document.metadata.ref,
  };
}

async function toWriterError(
  response: Response,
  fallbackMessage: string
): Promise<EditionWriterError> {
  const payload = await response.json().catch(() => ({}));
  const message =
    payload && typeof payload.error === "string"
      ? payload.error
      : fallbackMessage;

  return new EditionWriterError(message, {
    status: response.status,
    expectedRevision:
      typeof payload?.expectedRevision === "number"
        ? payload.expectedRevision
        : undefined,
    actualRevision:
      typeof payload?.actualRevision === "number"
        ? payload.actualRevision
        : undefined,
  });
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
        return Result.fail(
          await toWriterError(response, "Error al crear el documento")
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
        return Result.fail(await toWriterError(response, "Error al actualizar"));
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
        return Result.fail(
          await toWriterError(response, "Error al eliminar")
        );
      }
      return Result.ok();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new EditionWriterError(message, { cause: error }));
    }
  }
}
