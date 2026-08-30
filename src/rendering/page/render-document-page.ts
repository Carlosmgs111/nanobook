import { contentRepository } from "../../document";
import { computeContentHash } from "../../document/model/hash";
import { parseDocument } from "../../document/parse/document";
import type { Heading } from "../../document/parse/document";
import { createRenderedPageCache } from "../adapters/cache/factory";
import { UnifiedMarkdownRenderer } from "../adapters/markdown/unified-markdown";
import { PageRenderer, type RenderedPageData } from "./page-renderer";

export interface RenderDocumentPageResult {
  rendered: RenderedPageData;
  headings: Heading[];
  contentHash: string;
}

export async function renderDocumentPage(
  slug: string,
): Promise<RenderDocumentPageResult | null> {
  const documentId = slug || "index";

  const document = await contentRepository.get(documentId);

  if (!document) {
    return null;
  }

  const cache = createRenderedPageCache();
  const renderer = new PageRenderer(
    contentRepository,
    new UnifiedMarkdownRenderer(),
    cache,
  );

  const contentHash = computeContentHash(document);
  const rendered = await renderer.render(documentId, contentHash);

  if (!rendered) {
    return null;
  }

  const { headings } = parseDocument({ body: document.content });

  return { rendered, headings, contentHash };
}
