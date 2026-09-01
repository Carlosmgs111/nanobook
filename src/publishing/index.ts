import { DocumentCreated, DocumentUpdated } from "../document";
import type { EventHandler } from "../shared/bus/EventBus";

export type { RenderedDocumentPage } from "./domain/render";

import type { RenderedPageCache } from "./domain/cache";
import { eventBus } from "../shared/bus";
import { PagePublisher } from "./application/PagePublisher";
import { createRenderedPageCache } from "./infraestructure/cache";
export { createRenderedPageCache };
import { type Result, ok, err } from "../shared/utils/result";
import { UnifiedMarkdownRenderer } from "./infraestructure/markdown/UnifiedMarkdownRenderer";
import { InvalidatePagesController } from "./infraestructure/api/InvalidatePagesController";
export { GitHubWebhookHandler } from "./infraestructure/GithubWebhookHandler";
export { WebhookController } from "./infraestructure/api/WebhookController";

class OnDocumentCreatedHandler implements EventHandler<DocumentCreated> {
  constructor(private pagePublisher: PagePublisher) {}
  async handle(event: DocumentCreated): Promise<Result<Error, void>> {
    if (!event.payload.id) return err(undefined);
    this.pagePublisher.invalidate([event.payload.id as string]);
    return ok();
  }
}

class OnDocumentUpdatedHandler implements EventHandler<DocumentUpdated> {
  constructor(private pagePublisher: PagePublisher) {}
  async handle(event: DocumentUpdated): Promise<Result<Error, void>> {
    if (!event.payload.id) return err(undefined);
    this.pagePublisher.invalidate([event.payload.id as string]);
    return ok();
  }
}

export class PublishingModule {
  constructor(
    public invalidatePagesController: InvalidatePagesController,
    public pagePublisher: PagePublisher,
    public pageRenderer: UnifiedMarkdownRenderer,
    public renderedPageCache: RenderedPageCache
  ) {
    eventBus.subscribe(
      DocumentCreated.name,
      new OnDocumentCreatedHandler(this.pagePublisher)
    );

    eventBus.subscribe(
      DocumentUpdated.name,
      new OnDocumentUpdatedHandler(this.pagePublisher)
    );
  }

  static async create() {
    const pageRenderer = new UnifiedMarkdownRenderer();
    const renderedPageCache = await createRenderedPageCache();

    const pagePublisher = new PagePublisher(pageRenderer, renderedPageCache);

    const invalidatePagesController = new InvalidatePagesController(
      pagePublisher.invalidate
    );
    return new PublishingModule(
      invalidatePagesController,
      pagePublisher,
      pageRenderer,
      renderedPageCache
    );
  }
}
