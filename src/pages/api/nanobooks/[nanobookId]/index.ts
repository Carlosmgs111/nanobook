import type { APIRoute } from "astro";
import { getApp } from "../../../../application/server/Application";

const app = await getApp();
export const prerender = false;
export const PATCH: APIRoute = app.routeProtector.protect(app.nanobookModule.lifecycleController.update);
export const DELETE: APIRoute = app.routeProtector.protect(app.nanobookModule.lifecycleController.delete);
