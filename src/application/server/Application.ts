import { AuthServerModule } from "../../auth/server";
import { Document } from "../../documents/server/domain/Document";
import { DocumentModule } from "../../documents/server";
import { DocumentModuleDocumentProvider } from "../../documents/server/infraestructure/navigation/DocumentModuleDocumentProvider";
import { NavigationModule } from "../../navigation/server";
import { ProfileModule } from "../../profiles/server";
import { PublishingModule } from "../../publishing/server";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { NanobookModule } from "../../nanobooks/server";
import type {
  NanobookCreationTransaction,
  NanobookRootInitializer,
} from "../../nanobooks/server/application/NanobookCreationTransaction";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";

export interface NanobookContextModules {
  EventBus: typeof InMemoryEventBus;
  DocumentModule: typeof DocumentModule;
  DocumentModuleDocumentProvider: typeof DocumentModuleDocumentProvider;
  NavigationModule: typeof NavigationModule;
  PublishingModule: typeof PublishingModule;
}

export class Application {
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly routeProtector: RouteProtector,
    public readonly profileModule: ProfileModule,
    public readonly nanobookModule: NanobookModule,
  ) {}

  static async create(): Promise<Application> {
    const authServerModule = await AuthServerModule.create();
    const routeProtector: RouteProtector = authServerModule;
    const profileModule = ProfileModule.create(routeProtector);
    const nanobookContextModules: NanobookContextModules = {
      EventBus: InMemoryEventBus,
      DocumentModule,
      DocumentModuleDocumentProvider,
      NavigationModule,
      PublishingModule,
    };
    const initializeNanobookRoot = createNanobookRootInitializer();
    const nanobookModule = await NanobookModule.create(
      routeProtector,
      nanobookContextModules,
      initializeNanobookRoot,
    );

    return new Application(
      authServerModule,
      routeProtector,
      profileModule,
      nanobookModule,
    );
  }
}

let appPromise: Promise<Application> | null = null;

export function getApp(): Promise<Application> {
  if (!appPromise) {
    appPromise = Application.create();
  }
  return appPromise;
}

function createNanobookRootInitializer(): NanobookRootInitializer {
  return async (
    nanobook,
    transaction: NanobookCreationTransaction,
  ): Promise<void> => {
    const document = Document.create("index", {
      id: crypto.randomUUID(),
      title: nanobook.getName(),
      description: nanobook.getName(),
      ownerId: nanobook.getOwnerId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      author: nanobook.getOwnerId(),
    }, `# ${nanobook.getName()}\n`);
    if (!document.isSuccess) throw document.getError();

    const root = document.getValue();
    await transaction.insertDocument(root);
    await transaction.appendRevision({
      documentId: root.getDocumentId().getValue(),
      revision: root.getRevision(),
      snapshot: root.parse(),
      actorId: nanobook.getOwnerId(),
      operation: "create",
    });
    await transaction.incrementContentVersion();
    await transaction.enqueueEvent("document.created", {
      documentId: root.getDocumentId().getValue(),
    });
  };
}
