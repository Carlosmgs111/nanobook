// src/spreadsheets/browser/saveSpreadsheet.ts
import type { Cell } from "../shared/sheet";

/** Lo que la página entrega a la isla cuando el visitante puede escribir en el documento. */
export interface SpreadsheetContext {
  nanobookId: string;
  documentPath: string;
  /**
   * Presente cuando la página no conocía la sesión: solo ese usuario ve el botón
   * de guardar (el servidor sigue exigiendo el permiso al guardar).
   */
  ownerId?: string;
}

export type SaveOutcome = "saved" | "stale" | "error";

/** Pide al servidor que guarde en el documento las celdas cambiadas; nunca lanza. */
export async function saveSpreadsheet(
  context: SpreadsheetContext,
  original: readonly (readonly Cell[])[],
  next: readonly (readonly Cell[])[],
  fetcher: typeof fetch = fetch,
): Promise<SaveOutcome> {
  try {
    const response = await fetcher(`/api/nanobooks/${encodeURIComponent(context.nanobookId)}/spreadsheets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentPath: context.documentPath, original, next }),
    });
    if (response.ok) return "saved";
    return response.status === 409 ? "stale" : "error";
  } catch {
    return "error";
  }
}
