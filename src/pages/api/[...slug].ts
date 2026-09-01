import {
  createPatchHandler,
  createPostHandler,
} from "../../document/_infraestructure/api/Handlers";

export const prerender = false;
export const PATCH = createPatchHandler();
export const POST = createPostHandler();
