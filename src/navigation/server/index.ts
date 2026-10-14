export type { NavigationService };
export type {
  Crumb,
  NavigationNode,
  ParentEntry,
  InvalidationResult,
} from "./domain/types";
export type { DocumentProvider } from "./domain/ports/DocumentProvider";
import { DocumentCreated } from "../../documents/server/domain/events/DocumentCreated";
import { DocumentUpdated } from "../../documents/server/domain/events/DocumentUpdated";
import { DocumentDeleted } from "../../documents/server/domain/events/DocumentDeleted";
import { Result } from "../../shared/domain/Result";
import { EventBusError } from "../../shared/domain/bus/errors";
import type { EventBus, EventHandler } from "../../shared/domain/bus/EventBus";
import { NavigationService } from "./application/NavigationService";
import { DocumentsGraph } from "./infraestructure/DocumentsGraph";
import type { DocumentProvider } from "./domain/ports/DocumentProvider";

export class NavigationModule {
  private constructor(
    public readonly navigationService: NavigationService,
    private readonly documentProvider: DocumentProvider
  ) {}

  static async create(
    documentProvider: DocumentProvider,
    eventBus?: EventBus,
    options: { rootPath?: string; basePath?: string } = {},
  ) {
    const documents = await documentProvider.getAll();
    const documentGraph = new DocumentsGraph(documents);
    const navigationService = new NavigationService(documentGraph, options);
    const module = new NavigationModule(navigationService, documentProvider);

    if (eventBus) {
      const handler:
        & EventHandler<DocumentCreated>
        & EventHandler<DocumentUpdated>
        & EventHandler<DocumentDeleted> = {
        handle: async () => {
          try {
            await module.refresh();
            return Result.ok();
          } catch (error) {
            return Result.fail(
              new EventBusError("Failed to refresh navigation graph", {
                cause: error,
              })
            );
          }
        },
      };

      eventBus.subscribe(DocumentCreated, handler);
      eventBus.subscribe(DocumentUpdated, handler);
      eventBus.subscribe(DocumentDeleted, handler);
    }

    return module;
  }

  async refresh(): Promise<void> {
    const documents = await (this.documentProvider.refresh?.() ?? this.documentProvider.getAll());
    this.navigationService.replaceGraph(new DocumentsGraph(documents));
  }
}
