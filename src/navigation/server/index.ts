export type { NavigationService };
export type {
  Crumb,
  NavigationNode,
  ParentEntry,
  InvalidationResult,
} from "./domain/types";
import type { DocumentModule } from "../../documents/server";
import { DocumentCreated } from "../../documents/server/domain/events/DocumentCreated";
import { DocumentUpdated } from "../../documents/server/domain/events/DocumentUpdated";
import { DocumentDeleted } from "../../documents/server/domain/events/DocumentDeleted";
import { Result } from "../../shared/domain/Result";
import { EventBusError } from "../../shared/domain/bus/errors";
import type { EventBus, EventHandler } from "../../shared/domain/bus/EventBus";
import { NavigationService } from "./application/NavigationService";
import { DocumentsGraph } from "./infraestructure/DocumentsGraph";

type NavigationDocuments = Pick<
  DocumentModule,
  "getAllDocuments" | "refreshDocuments"
>;

export class NavigationModule {
  private constructor(private readonly documents: NavigationDocuments) {}

  static async create(documents: NavigationDocuments, eventBus: EventBus) {
    const module = new NavigationModule(documents);
    const handler:
      & EventHandler<DocumentCreated>
      & EventHandler<DocumentUpdated>
      & EventHandler<DocumentDeleted> = {
      handle: async (event) => {
        if (!event.nanobookId) return Result.ok();
        try {
          await documents.refreshDocuments(event.nanobookId);
          return Result.ok();
        } catch (error) {
          return Result.fail(new EventBusError("Failed to refresh navigation documents", {
            cause: error,
          }));
        }
      },
    };
    eventBus.subscribe(DocumentCreated, handler);
    eventBus.subscribe(DocumentUpdated, handler);
    eventBus.subscribe(DocumentDeleted, handler);
    return module;
  }

  async getNavigation(
    nanobookId: string,
    options: { rootPath?: string; basePath?: string } = {},
  ): Promise<NavigationService> {
    const entries = await this.documents.getAllDocuments.execute(nanobookId);
    return new NavigationService(new DocumentsGraph(entries), options);
  }
}
