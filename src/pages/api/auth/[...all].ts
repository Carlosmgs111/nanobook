import { getApp } from "../../../application/server/Application";

const app = await getApp();

export const ALL = app.authServerModule.authController;
