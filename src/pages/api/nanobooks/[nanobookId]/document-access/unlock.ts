import type { APIRoute } from "astro";
import { Subject } from "../../../../../authorization/server";
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

  const decision = await app.authorizer.authorize({
    subject: Subject.anonymous(),
    action: "read",
    resource: { type: "nanobook", id: nanobookId },
  });
  if (decision.effect !== "allow") {
    return new Response(JSON.stringify({ error: "Documento no encontrado" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return app.nanobookModule.documentModule.unlockDocumentController.handle(context);
};
