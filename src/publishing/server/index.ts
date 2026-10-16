import type { EventBus } from "../../shared/domain/bus/EventBus";
import type { RenderedPageCache } from "./domain/cache";
import { DocumentCreated, DocumentUpdated, DocumentDeleted } from "../../documents/server";
import { PagePublisher } from "./application/PagePublisher";
import { OnDocumentCreatedHandler } from "./application/event-handlers/OnDocumentCreatedHandler";
import { OnDocumentUpdatedHandler } from "./application/event-handlers/OnDocumentUpdatedHandler";
import { OnDocumentDeletedHandler } from "./application/event-handlers/OnDocumentDeletedHandler";
import { createRenderedPageCache } from "./infraestructure/cache";
import { UnifiedMarkdownRenderer } from "./infraestructure/renderer/UnifiedMarkdownRenderer";
import { InvalidatePagesController } from "./infraestructure/api/InvalidatePagesController";

export type { RenderedDocumentPage } from "./domain/render";

export class PublishingModule {
  private unsubscribes: (() => void)[] = [];

  constructor(
    public readonly invalidatePagesController: InvalidatePagesController,
    public readonly pagePublisher: PagePublisher,
    public readonly pageRenderer: UnifiedMarkdownRenderer,
    public readonly renderedPageCache: RenderedPageCache,
    public readonly eventBus: EventBus
  ) {}

  static async create(
    eventBus: EventBus,
  ) {
    const pageRenderer = new UnifiedMarkdownRenderer();
    const renderedPageCache = await createRenderedPageCache();

    const pagePublisher = new PagePublisher(pageRenderer, renderedPageCache);

    const invalidatePagesController = new InvalidatePagesController(pagePublisher);
    const module = new PublishingModule(
      invalidatePagesController,
      pagePublisher,
      pageRenderer,
      renderedPageCache,
      eventBus
    );
    module.registerEventHandlers();
    return module;
  }

  registerEventHandlers() {
    if (this.unsubscribes.length) return;
    this.unsubscribes.push(
      this.eventBus.subscribe(
        DocumentCreated,
        new OnDocumentCreatedHandler(this.pagePublisher)
      )
    );
    this.unsubscribes.push(
      this.eventBus.subscribe(
        DocumentUpdated,
        new OnDocumentUpdatedHandler(this.pagePublisher)
      )
    );
    this.unsubscribes.push(
      this.eventBus.subscribe(
        DocumentDeleted,
        new OnDocumentDeletedHandler(this.pagePublisher)
      )
    );
  }

  unregisterEventHandlers() {
    this.unsubscribes.forEach((unsubscribe) => unsubscribe());
    this.unsubscribes = [];
  }
}
