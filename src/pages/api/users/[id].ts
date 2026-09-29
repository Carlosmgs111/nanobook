import { getApp } from "../../../Application";

const app = await getApp();

export const prerender = false;

export const GET = app.userModule.getUserController.handle;
export const PATCH = app.userModule.updateUserController.handle;
export const DELETE = app.userModule.deleteUserController.handle;
