import { getApp } from "../../../server/Application";

const app = await getApp();

export const prerender = false;
export const GET = app.profileModule.getPublicProfileController.handle;
