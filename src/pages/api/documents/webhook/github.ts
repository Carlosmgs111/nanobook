import { getApp } from "../../../../application/server/Application";
import { shouldUseNanobookSqlCutover } from "../../../../application/server/legacyRouteMode";
const app = await getApp();

export const POST = async (context: Parameters<import("astro").APIRoute>[0]) => {
  if (shouldUseNanobookSqlCutover()) {
    return new Response("Webhook de GitHub desactivado durante el corte SQL", {
      status: 410,
    });
  }
  return app.githubWebhookController.handle(context);
};
