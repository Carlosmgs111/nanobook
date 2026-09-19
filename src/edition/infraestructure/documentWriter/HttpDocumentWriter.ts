import type { DocumentWriter } from "../../application/ports/DocumentWriter";
import type {
  SerializedEntry,
  CreateDocumentRequest,
  UpdateDocumentRequest,
} from "../../../document";

function toUpdateDocumentRequest(
  document: SerializedEntry
): UpdateDocumentRequest {
  return {
    id: document.id,
    title: document.title,
    description: document.description,
    content: document.content,
    date: document.metadata.date,
    index: document.metadata.index,
    author: document.metadata.author,
    cover: document.metadata.cover,
    tags: document.metadata.tags,
    draft: document.metadata.draft,
    position: document.metadata.position,
    ref: document.metadata.ref,
  };
}

export class HttpDocumentWriter implements DocumentWriter {
  async createDocument(
    document: CreateDocumentRequest
  ): Promise<SerializedEntry> {
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Error al crear el documento");
    }

    return response.json();
  }

  async updateDocument(
    documentId: string,
    document: SerializedEntry
  ): Promise<SerializedEntry> {
    const response = await fetch("/api/" + documentId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toUpdateDocumentRequest(document)),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Error al actualizar");
    }

    return response.json();
  }
}
