import { AuthServerModule } from "../../auth/server";
import { DocumentModule } from "../../documents/server";
import { DocumentModuleDocumentProvider } from "../../documents/server/infraestructure/navigation/DocumentModuleDocumentProvider";
import { NavigationModule } from "../../navigation/server";
import { ProfileModule } from "../../profiles/server";
import { PublishingModule } from "../../publishing/server";
import { Result } from "../../shared/domain/Result";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import {
  CreateNanobookController,
  NanobookModule,
} from "../../nanobooks/server";
import type {
  CreateNanobook,
  CreateNanobookError,
} from "../../nanobooks/server/application/CreateNanobook";
import type { Nanobook } from "../../nanobooks/server/domain/Nanobook";
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
    public readonly createNanobookController: CreateNanobookController,
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
    const nanobookModule = await NanobookModule.create(
      routeProtector,
      nanobookContextModules,
    );
    const createNanobook = createNanobookWithRoot(
      nanobookModule.createNanobook,
      routeProtector,
      nanobookContextModules,
    );

    return new Application(
      authServerModule,
      routeProtector,
      profileModule,
      nanobookModule,
      new CreateNanobookController(createNanobook),
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

function createNanobookWithRoot(
  createNanobook: CreateNanobook,
  routeProtector: RouteProtector,
  modules: NanobookContextModules,
): Pick<CreateNanobook, "execute"> {
  return {
    execute: async (ownerId, input) => {
      const nanobookResult = await createNanobook.execute(ownerId, input);
      if (!nanobookResult.isSuccess) return nanobookResult;

      const nanobook = nanobookResult.getValue();
      const documentModule = await modules.DocumentModule.create(
        new modules.EventBus(),
        routeProtector,
        nanobook.getId(),
      );
      const rootResult = await documentModule.createDocument.execute({
        id: crypto.randomUUID(),
        path: "index",
        title: nanobook.getName(),
        description: nanobook.getName(),
        content: `# ${nanobook.getName()}\n`,
        ownerId: nanobook.getOwnerId(),
        author: nanobook.getOwnerId(),
      });
      if (!rootResult.isSuccess) {
        return Result.fail(rootResult.getError() as CreateNanobookError);
      }
      return Result.ok<Nanobook>(nanobook);
    },
  };
}
