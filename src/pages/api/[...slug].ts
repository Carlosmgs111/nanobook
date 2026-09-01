import { getApp } from "../../Application";
const app = await getApp();

export const prerender = false;

export const PATCH = app.documentModule.updateDocumentController.handle;
export const POST = app.documentModule.createDocumentController.handle;
