import { getApp } from "../../../application/server/Application";

const app = await getApp();

export const prerender = false;
export const { GET, POST, PATCH } = app.profileModule.privateProfileRoutes;
