import type { NanobookContextModules } from "../../../application/server/Application";
import type { RouteProtector } from "../../../shared/server/capabilities/RouteProtector";
import type { Nanobook } from "../domain/Nanobook";

type ContextDocumentModule = Awaited<ReturnType<NanobookContextModules["DocumentModule"]["create"]>>;
type ContextNavigationModule = Awaited<ReturnType<NanobookContextModules["NavigationModule"]["create"]>>;
type ContextPublishingModule = Awaited<ReturnType<NanobookContextModules["PublishingModule"]["create"]>>;
type ContextEventBus = InstanceType<NanobookContextModules["EventBus"]>;

/**
 * Capacidades server-side aisladas para una colección concreta.
 *
 * El contexto no autoriza por sí mismo; quien lo resuelve debe haber validado
 * el actor antes de exponer sus módulos a una request.
 */
export class NanobookContext {
  constructor(
    public readonly nanobook: Nanobook,
    public readonly documentModule: ContextDocumentModule,
    public readonly navigationModule: ContextNavigationModule,
    public readonly publishingModule: ContextPublishingModule,
    private readonly eventBus: ContextEventBus,
  ) {}

  static async create(
    nanobook: Nanobook,
    routeProtector: RouteProtector,
    modules: NanobookContextModules,
  ): Promise<NanobookContext> {
    const eventBus = new modules.EventBus();
    const publishingModule = await modules.PublishingModule.create(eventBus, {
      cacheNamespace: nanobook.getId(),
    });
    publishingModule.registerEventHandlers();

    const documentModule = await modules.DocumentModule.create(eventBus, routeProtector, {
      source: "sql",
      nanobookId: nanobook.getId(),
    });
    const documentProvider = new modules.DocumentModuleDocumentProvider(documentModule);
    const navigationModule = await modules.NavigationModule.create(
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
