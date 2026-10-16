export function json(value: unknown, status: number) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

export function responseForError(error: Error): Response {
  const status = error.name === "ThemeAccessDeniedError" ? 403
    : error.name === "ThemeNotFoundError" ? 404
      : error.name === "InvalidThemeError" ? 400 : 500;
  return json({ error: status === 500 ? "No fue posible completar la operación" : error.message }, status);
}
