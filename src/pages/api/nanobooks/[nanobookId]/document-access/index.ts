import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";
import { protectNanobookWriteMutation } from "../../../../../nanobooks/server/infraestructure/rest/withNanobookWriteAccess";

export const prerender = false;

const app = await getApp();
const controller = app.nanobookModule.documentModule.documentAccessAdminController;

function dispatch(handler: APIRoute): APIRoute {
  return protectNanobookWriteMutation(
    app.routeProtector,
    app.nanobookModule.requireNanobookAccess,
    handler,
  );
}

export const PUT = dispatch(controller.put);
export const DELETE = dispatch(controller.delete);
