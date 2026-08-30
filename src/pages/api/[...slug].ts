import {
  createPatchHandler,
  createPostHandler,
} from "../../document/api/document";
import { documentService } from "../../document/index";

export const prerender = false;
export const PATCH = createPatchHandler(documentService);
export const POST = createPostHandler(documentService);
