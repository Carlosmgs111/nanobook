import type { APIRoute } from "astro";

/**
 * Capacidad para proteger una ruta HTTP con la política de autenticación
 * configurada por la aplicación.
 */
export interface RouteProtector {
  protect(handler: APIRoute): APIRoute;
}
