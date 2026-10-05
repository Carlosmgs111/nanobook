import { getApp } from "../../../Application";
import { authModule } from "../../../auth/server";
import { protectDocumentMutationRoutes } from "../../../documents/infraestructure/rest/protectDocumentMutationRoutes";

const app = await getApp();
const mutations = protectDocumentMutationRoutes(authModule, {
  POST: app.documentModule.createDocumentController.handle,
  PATCH: app.documentModule.updateDocumentController.handle,
  DELETE: app.documentModule.deleteDocumentController.handle,
});

export const prerender = false;

export const { POST, PATCH, DELETE } = mutations;
