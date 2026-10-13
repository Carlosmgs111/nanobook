import { getApp } from "../../../application/server/Application";

const app = await getApp();

export const POST = app.publishingModule.invalidatePagesController.handle;
