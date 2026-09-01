import type { Entry } from "../../document/domain/types";

export interface CreateDocumentPayload {
  id: string;
  title: string;
  description: string;
  author?: string;
  date?: string;
  index?: boolean;
  position?: number;
  draft?: boolean;
  tags?: string[];
}

export async function createDocument(
  payload: CreateDocumentPayload
): Promise<Entry> {
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
