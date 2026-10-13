import type { RouteProtector } from "../../../documents/server/infraestructure/rest/protectDocumentMutationRoutes";
import { DocumentModule } from "../../../documents/server";
import { DocumentModuleDocumentProvider } from "../../../documents/server/infraestructure/navigation/DocumentModuleDocumentProvider";
import { InMemoryEventBus } from "../../../shared/infrastructure/InMemoryEventBus";
import { NavigationModule } from "../../../navigation/server";
import { PublishingModule } from "../../../publishing/server";
import type { Nanobook } from "../domain/Nanobook";

/**
 * Capacidades server-side aisladas para una colección concreta.
 *
 * El contexto no autoriza por sí mismo; quien lo resuelve debe haber validado
 * el actor antes de exponer sus módulos a una request.
 */
export class NanobookContext {
  constructor(
    public readonly nanobook: Nanobook,
    public readonly documentModule: DocumentModule,
    public readonly navigationModule: NavigationModule,
    public readonly publishingModule: PublishingModule,
    private readonly eventBus: InMemoryEventBus,
  ) {}

  static async create(
    nanobook: Nanobook,
    routeProtector: RouteProtector,
  ): Promise<NanobookContext> {
    const eventBus = new InMemoryEventBus();
    const publishingModule = await PublishingModule.create(eventBus, {
      cacheNamespace: nanobook.getId(),
    });
    publishingModule.registerEventHandlers();

    const documentModule = await DocumentModule.create(eventBus, routeProtector, {
      source: "sql",
      nanobookId: nanobook.getId(),
    });
    const documentProvider = new DocumentModuleDocumentProvider(documentModule);
    const navigationModule = await NavigationModule.create(
      documentProvider,
      eventBus,
      { rootPath: "index" },
    );

    return new NanobookContext(
      nanobook,
      documentModule,
      navigationModule,
      publishingModule,
      eventBus,
    );
  }

  get contentVersion(): number {
    return this.nanobook.getContentVersion();
  }

  close(): void {
    this.publishingModule.unregisterEventHandlers();
    this.eventBus.clear();
  }
}
