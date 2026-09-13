import type { EventBus } from "../shared/bus/EventBus";
import type { RenderedPageCache } from "./domain/cache";
import { DocumentCreated, DocumentUpdated } from "../document";
import { PagePublisher } from "./application/PagePublisher";
import { OnDocumentCreatedHandler } from "./application/event-handlers/OnDocumentCreatedHandler";
import { OnDocumentUpdatedHandler } from "./application/event-handlers/OnDocumentUpdatedHandler";
import { createRenderedPageCache } from "./infraestructure/cache";
import { UnifiedMarkdownRenderer } from "./infraestructure/markdown/UnifiedMarkdownRenderer";
import { InvalidatePagesController } from "./infraestructure/api/InvalidatePagesController";

export { GitHubWebhookHandler } from "./infraestructure/GithubWebhookHandler";
export { GitHubWebhookController } from "./infraestructure/api/GitHubWebhookController";
export type { RenderedDocumentPage } from "./domain/render";

export class PublishingModule {
  constructor(
    public readonly invalidatePagesController: InvalidatePagesController,
    public readonly pagePublisher: PagePublisher,
    public readonly pageRenderer: UnifiedMarkdownRenderer,
    public readonly renderedPageCache: RenderedPageCache,
    public readonly eventBus: EventBus
  ) {}

  static async create(eventBus: EventBus) {
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
      renderedPageCache,
      eventBus
    );
  }

  registerEventHandlers() {
    this.eventBus.subscribe(
      DocumentCreated.name,
      new OnDocumentCreatedHandler(this.pagePublisher)
    );
    this.eventBus.subscribe(
      DocumentUpdated.name,
      new OnDocumentUpdatedHandler(this.pagePublisher)
    );
  }
}
