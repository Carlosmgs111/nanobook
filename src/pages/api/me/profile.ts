import { getApp } from "../../../server/Application";

const app = await getApp();

export const prerender = false;
export const { GET, POST, PATCH } = app.profileModule.privateProfileRoutes;
