import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";

export const prerender = false;

const app = await getApp();
const controller = app.nanobookModule.documentModule.documentAccessAdminController;

function dispatch(handler: APIRoute): APIRoute {
  return app.routeProtector.protect(handler);
}

export const PUT = dispatch(controller.put);
export const DELETE = dispatch(controller.delete);
