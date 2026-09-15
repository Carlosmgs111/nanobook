import type { SerializedEntry } from "../../document/application/dto/SerializedEntry";
import type { UpdateDocumentRequest } from "../../document/application/dto/UpdateDocumentRequest";

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

export async function updateDocument(
  documentId: string,
  document: SerializedEntry
): Promise<void> {
  const response = await fetch("/api/" + documentId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toUpdateDocumentRequest(document)),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Error al actualizar");
  }
}
