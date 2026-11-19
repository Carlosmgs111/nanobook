import type { APIRoute } from "astro";
import { getApp } from "../../../../application/server/Application";

export const prerender = false;

const app = await getApp();

export const PATCH: APIRoute = app.routeProtector.protect(app.spreadsheetsServerModule.saveSpreadsheetController.handle);
