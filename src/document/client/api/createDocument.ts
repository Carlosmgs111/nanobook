import type { CreateDocumentRequest } from "../../application/dto/CreateDocumentRequest";
import type { SerializedEntry } from "../../application/dto/SerializedEntry";

export type { CreateDocumentRequest };

export async function createDocument(
  payload: CreateDocumentRequest
): Promise<SerializedEntry> {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Error al crear el documento");
  }

  return response.json();
}
