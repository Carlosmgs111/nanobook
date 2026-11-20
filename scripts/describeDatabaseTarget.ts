/** Describes where a libSQL URL points, without credentials, for logging before touching a database. */
export function describeDatabaseTarget(url: string): string {
  if (url.startsWith("file:")) return `archivo local ${url.slice("file:".length)}`;
  if (url === ":memory:") return "memoria";
  try {
    const parsed = new URL(url);
    return `remota ${parsed.host}`;
  } catch {
    return "destino desconocido";
  }
}
