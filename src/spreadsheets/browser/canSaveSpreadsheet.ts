// src/spreadsheets/browser/canSaveSpreadsheet.ts
import type { SpreadsheetContext } from "./saveSpreadsheet";

/**
 * Decide si el visitante actual puede ver el botón de guardar. Con `ownerId`
 * la página no conocía la sesión, así que se consulta aquí y solo el propietario
 * lo ve. Hace su propio `fetch` mínimo en lugar de importar el módulo `auth`:
 * `spreadsheets` no debe depender de los internos de otro módulo del navegador.
 * Nunca lanza.
 */
export async function canSaveSpreadsheet(
  context: SpreadsheetContext,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (context.ownerId === undefined) return true;
  try {
    const response = await fetcher("/api/auth/get-session", { credentials: "include" });
    if (!response.ok) return false;
    const payload = (await response.json()) as unknown;
    if (typeof payload !== "object" || payload === null) return false;
    const user = (payload as { user?: unknown }).user;
    if (typeof user !== "object" || user === null) return false;
    return (user as { id?: unknown }).id === context.ownerId;
  } catch {
    return false;
  }
}
