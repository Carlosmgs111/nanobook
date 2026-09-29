import { getApp } from "../../../Application";

const app = await getApp();

export const prerender = false;

export const POST = app.userModule.createUserController.handle;
export const GET = app.userModule.getUserByEmailController.handle;
