import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";

export const prerender = false;

const app = await getApp();

/**
 * Public: readers have no session. Only public nanobooks serve a challenge, so
 * a private nanobook answers 404 and cannot be probed for passwords.
 */
export const POST: APIRoute = async (context) => {
  const nanobookId = context.params.nanobookId;
  if (!nanobookId) return new Response(null, { status: 404 });

  const access = await app.nanobookModule.requireNanobookAccess.execute(undefined, nanobookId, "read");
  if (!access.isSuccess) {
    return new Response(JSON.stringify({ error: "Documento no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return app.nanobookModule.documentModule.unlockDocumentController.handle(context);
};
