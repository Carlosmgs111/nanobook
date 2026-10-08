import { getApp } from "../../../server/Application";

const app = await getApp();

export const POST = app.publishingModule.invalidatePagesController.handle;
