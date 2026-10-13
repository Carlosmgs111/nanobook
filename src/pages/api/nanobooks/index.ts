import type { APIRoute } from "astro";
import { getApp } from "../../../application/server/Application";

const app = await getApp();
export const prerender = false;
export const POST: APIRoute = app.routeProtector.protect(
  app.createNanobookController.handle,
);
export const GET: APIRoute = app.routeProtector.protect(
  app.nanobookModule.listNanobooksController.handle,
);
