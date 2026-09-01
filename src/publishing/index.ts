import { PagePublisher } from "./application/PagePublisher";
import { createRenderedPageCache } from "./infraestructure/cache";
import { UnifiedMarkdownRenderer } from "./infraestructure/markdown/UnifiedMarkdownRenderer";
import { ContentService } from "./infraestructure/document/ContentService";
import { navigationService } from "../navigation";

const contentService = new ContentService();
const pageRenderer = new UnifiedMarkdownRenderer();
const renderedPageCache = await createRenderedPageCache();

export const pagePublisher = new PagePublisher(
  pageRenderer,
  renderedPageCache,
  contentService,
  navigationService
);
