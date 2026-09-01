
import { createContentRepository } from "./_infraestructure/repository";
import { createRenderedPageCache } from "../publishing/infraestructure/cache";
import { ParsePath } from "./_infraestructure/parse/parsePath";
export { parseDocument } from "./_infraestructure/parse/DocumentParser";
import { ParseFrontmatter } from "./_infraestructure/parse/parseFrontmatter";
import { ParseProxy } from "./_infraestructure/parse/parseProxy";
import { CreateDocument } from "./_application/CreateDocument";
import { UpdateDocument } from "./_application/UpdateDocument";

/* 🚧 */
export const parsePath = new ParsePath();
export const parseFrontmatter = new ParseFrontmatter().parseFrontmatter;
const proxyParser = new ParseProxy();
export const parseProxy = proxyParser.parseProxy;
/* 🚧 */

const pageRenderedCache = await createRenderedPageCache();

export const contentRepository = await createContentRepository(proxyParser.parseProxies);
export const createDocument = new CreateDocument(
  contentRepository,
  pageRenderedCache,
);

export const updateDocument = new UpdateDocument(
  contentRepository,
  pageRenderedCache
);
