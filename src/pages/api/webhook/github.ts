import { getApp } from "../../../Application";
const app = await getApp();

export const POST = app.githubWebhookController.handle;
