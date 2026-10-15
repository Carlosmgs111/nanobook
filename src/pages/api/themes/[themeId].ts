import type { APIRoute } from "astro";
import { getApp } from "../../../application/server/Application";

const app = await getApp();
export const prerender = false;
export const GET: APIRoute = app.themeModule.itemRoutes.GET;
export const PATCH: APIRoute = app.themeModule.itemRoutes.PATCH;
