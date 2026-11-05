import { createHash } from "node:crypto";

/**
 * Transporte del grant de acceso: todo lo que sabe de cookies vive aquí, en el
 * borde HTTP. El dominio y los casos de uso solo manejan el token.
 */

/** Nombre de cookie estable y propio de cada documento (no revela el id). */
export function grantCookieName(documentId: string): string {
  return `nbk-grant-${createHash("sha256").update(documentId).digest("hex").slice(0, 16)}`;
}

/** Lee el valor de una cookie desde una cabecera `Cookie`. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

/** Devuelve una función que entrega el token presentado para cada documento. */
export function grantsFromCookieHeader(header: string | null | undefined) {
  return (documentId: string): string | undefined => readCookie(header, grantCookieName(documentId));
}

/** Construye la cabecera `Set-Cookie` del grant. */
export function serializeGrantCookie(documentId: string, token: string, maxAgeSeconds: number): string {
  const secure = process.env.VERCEL === "1" ? "; Secure" : "";
  return `${grantCookieName(documentId)}=${token}; Path=/n; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}
