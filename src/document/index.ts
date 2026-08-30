import { resolveProxies } from "../document/parse/proxy";
import { createContentRepository } from "./adapters/repository/factory";
import { DocumentService } from "./service/document-service";
import { createRenderedPageCache } from "../rendering/adapters/cache/factory";
import { CONTENT_SOURCE } from "astro:env/server";

const contentSource = CONTENT_SOURCE;

console.log({ contentSource });

export const contentRepository = await createContentRepository(
  contentSource,
  resolveProxies
);
export const documentService = new DocumentService(
  contentRepository,
  createRenderedPageCache()
);
