import { createContentRepository } from "../../document/adapters/repository/factory";
import { createPatchHandler, createPostHandler } from "../../document/api/document";
import { DocumentService } from "../../document/service/document-service";
import { createRenderedPageCache } from "../../rendering/adapters/cache/factory";

const repository = await createContentRepository();
const cache = createRenderedPageCache();
const service = new DocumentService(repository, cache);

export const prerender = false;
export const PATCH = createPatchHandler(service);
export const POST = createPostHandler(service);
