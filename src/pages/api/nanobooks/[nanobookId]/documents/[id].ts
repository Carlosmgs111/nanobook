import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";

export const prerender = false;

const app = await getApp();

const documentMutations = {
  POST: app.nanobookModule.documentModule.createDocumentController.handle,
  PATCH: app.nanobookModule.documentModule.updateDocumentController.handle,
  DELETE: app.nanobookModule.documentModule.deleteDocumentController.handle,
};

function dispatch(method: keyof typeof documentMutations): APIRoute {
  return app.routeProtector.protect(documentMutations[method]);
}

export const POST = dispatch("POST");
export const PATCH = dispatch("PATCH");
export const DELETE = dispatch("DELETE");
