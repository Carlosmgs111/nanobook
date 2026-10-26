import { getApp } from "../../../application/server/Application";

const app = await getApp();

export const GET = app.authServerModule.authController;
