import type { APIRoute } from "astro";
import { getApp } from "../../../application/server/Application";

const app = await getApp();
export const prerender = false;
export const GET: APIRoute = app.themeModule.collectionRoutes.GET;
export const POST: APIRoute = app.themeModule.collectionRoutes.POST;
