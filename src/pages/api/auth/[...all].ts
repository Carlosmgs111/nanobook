import { getApp } from "../../../Application";

const app = await getApp();

export const ALL = app.authServerModule.authController;
