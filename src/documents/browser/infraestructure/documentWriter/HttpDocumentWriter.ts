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

/** Solo viajan los campos editables; identidad, auditoría y protección las gestiona el servidor. */
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

/** Ejecuta la petición y traduce respuestas no-2xx (401, 403, 409...) y fallos de red a `EditionWriterError`. */
async function send<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
  parse: (response: Response) => Promise<T>
): Promise<Result<EditionWriterError, T>> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      return Result.fail(await toWriterError(response, fallbackMessage));
    }
    return Result.ok(await parse(response));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Result.fail(new EditionWriterError(message, { cause: error }));
  }
}

const jsonBody = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export class HttpDocumentWriter implements DocumentWriter {
  createDocument(document: CreateDocumentRequest) {
    return send<SerializedEntry>(
      documentApiUrl(document.id),
      jsonBody("POST", document),
      "Error al crear el documento",
      (response) => response.json()
    );
  }

  updateDocument(documentId: string, document: SerializedEntry) {
    return send<SerializedEntry>(
      documentApiUrl(documentId),
      jsonBody("PATCH", toUpdateDocumentRequest(document)),
      "Error al actualizar",
      (response) => response.json()
    );
  }

  deleteDocument(documentId: string) {
    return send<void>(
      documentApiUrl(documentId),
      { method: "DELETE" },
      "Error al eliminar",
      async () => undefined
    );
  }
}
