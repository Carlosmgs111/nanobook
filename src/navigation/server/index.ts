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
import type { NavigationGraphCache } from "./application/NavigationGraphCache";
import { NavigationService } from "./application/NavigationService";
import { DocumentsGraph } from "./infraestructure/DocumentsGraph";
import { createNavigationGraphCache } from "./infraestructure/createNavigationGraphCache";
import type { DocumentsGraph as DocumentsGraphPort } from "./domain/types";

type NavigationDocuments = Pick<DocumentModule, "getAllDocuments">;

export class NavigationModule {
  private constructor(
    private readonly documents: NavigationDocuments,
    private readonly graphCache: NavigationGraphCache,
  ) {}

  static async create(
    documents: NavigationDocuments,
    eventBus: EventBus,
    graphCache: NavigationGraphCache = createNavigationGraphCache(),
  ) {
    const module = new NavigationModule(documents, graphCache);
    const handler: EventHandler<DocumentCreated> &
      EventHandler<DocumentUpdated> &
      EventHandler<DocumentDeleted> = {
      handle: async (event) => {
        if (!event.nanobookId) return Result.ok();
        try {
          await module.refreshGraph(event.nanobookId);
          return Result.ok();
        } catch (error) {
          return Result.fail(
            new EventBusError("Failed to refresh navigation documents", {
              cause: error,
            })
          );
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
    options: { rootPath?: string; basePath?: string } = {}
  ): Promise<NavigationService> {
    const navigationGraph = await this.graphCache.getOrCreate(
      nanobookId,
      () => this.buildGraph(nanobookId),
    );
    return new NavigationService(navigationGraph, options);
  }

  private refreshGraph(nanobookId: string): Promise<DocumentsGraphPort> {
    return this.graphCache.refresh(nanobookId, () => this.buildGraph(nanobookId));
  }

  private async buildGraph(nanobookId: string): Promise<DocumentsGraph> {
    console.log("Building graph for nanobookId:", nanobookId);
    const entries = await this.documents.getAllDocuments.execute(nanobookId);
    return new DocumentsGraph(entries);
  }
}
