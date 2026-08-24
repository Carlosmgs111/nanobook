import type { Document } from "../../document/model/types";

export async function saveDocument(
  documentId: string,
  document: Document
): Promise<void> {
  const response = await fetch("/api/" + documentId, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Error al guardar");
  }
}
