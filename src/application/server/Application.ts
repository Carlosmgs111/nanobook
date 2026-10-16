import { AuthServerModule } from "../../auth/server";
import { ProfileModule } from "../../profiles/server";
import { NanobookModule } from "../../nanobooks/server";
import { DocumentModuleDocumentProvider } from "../../documents/server/infraestructure/navigation/DocumentModuleDocumentProvider";
import { NavigationModule } from "../../navigation/server";
import { PublishingModule } from "../../publishing/server";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { ThemeModule } from "../../theme/server";

export class Application {
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly routeProtector: RouteProtector,
    public readonly profileModule: ProfileModule,
    public readonly nanobookModule: NanobookModule,
    public readonly navigationModule: NavigationModule,
    public readonly publishingModule: PublishingModule,
    public readonly themeModule: ThemeModule,
  ) {}

  static async create(): Promise<Application> {
    const authServerModule = await AuthServerModule.create();
    const routeProtector: RouteProtector = authServerModule;
    const profileModule = ProfileModule.create(routeProtector);
    const eventBus = new InMemoryEventBus();
    const nanobookModule = await NanobookModule.create(routeProtector, eventBus);
    const navigationModule = await NavigationModule.create(
      new DocumentModuleDocumentProvider(nanobookModule.documentModule),
      eventBus,
    );
    const publishingModule = await PublishingModule.create(eventBus);
    const themeModule = ThemeModule.create(
      routeProtector,
      nanobookModule.setNanobookTheme,
    );
    return new Application(
      authServerModule,
      routeProtector,
      profileModule,
      nanobookModule,
      navigationModule,
      publishingModule,
      themeModule,
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
