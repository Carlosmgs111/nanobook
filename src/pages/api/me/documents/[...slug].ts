import { getApp } from "../../../../server/Application";

const app = await getApp();

export const prerender = false;

export const { POST, PATCH, DELETE } = app.documentModule.mutationRoutes;
