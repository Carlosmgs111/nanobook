import { AuthServerModule } from "../../auth/server";
import { ProfileModule } from "../../profiles/server";
import { NanobookModule } from "../../nanobooks/server";
import type { Nanobook } from "../../nanobooks/server";
import { DocumentModuleDocumentProvider } from "../../documents/server/infraestructure/navigation/DocumentModuleDocumentProvider";
import { NavigationModule } from "../../navigation/server";
import { PublishingModule } from "../../publishing/server";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";
import { ThemeModule } from "../../theme/server";
import { AssignNanobookTheme } from "./AssignNanobookTheme";
import { AssignNanobookThemeController } from "./AssignNanobookThemeController";
import { resolveEffectiveNanobookTheme } from "./resolveEffectiveNanobookTheme";
import type { AppliedTheme } from "../../theme/server";

export type NanobookCapabilities = {
  navigationModule: Awaited<ReturnType<typeof NavigationModule.create>>;
  publishingModule: Awaited<ReturnType<typeof PublishingModule.create>>;
  theme: AppliedTheme;
};

export class Application {
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly routeProtector: RouteProtector,
    public readonly profileModule: ProfileModule,
    public readonly nanobookModule: NanobookModule,
    public readonly themeModule: ThemeModule,
    public readonly assignNanobookThemeController: AssignNanobookThemeController,
  ) {}

  static async create(): Promise<Application> {
    const authServerModule = await AuthServerModule.create();
    const routeProtector: RouteProtector = authServerModule;
    const profileModule = ProfileModule.create(routeProtector);
    const nanobookModule = await NanobookModule.create(routeProtector);
    const themeModule = ThemeModule.create(routeProtector);
    const assignNanobookThemeController = new AssignNanobookThemeController(
      new AssignNanobookTheme(themeModule.getAssignableTheme, nanobookModule.setNanobookTheme),
    );
    return new Application(
      authServerModule,
      routeProtector,
      profileModule,
      nanobookModule,
      themeModule,
      assignNanobookThemeController,
    );
  }

  /**
   * Construye las capacidades de presentación para una sola solicitud.
   *
   * El resultado no se guarda ni se registra por nanobook. En un runtime
   * serverless cada invocación debe volver a construir el grafo y el
   * publicador con el identificador explícito de la colección.
   */
  async createNanobookCapabilities(
    nanobook: Nanobook,
    request: Request,
  ): Promise<NanobookCapabilities> {
    const nanobookId = nanobook.getId();
    const documentProvider = new DocumentModuleDocumentProvider(
      this.nanobookModule.documentModule,
      nanobookId,
    );
    const navigationModule = await NavigationModule.create(
      documentProvider,
      undefined,
      {
        rootPath: "index",
        basePath: `/n/${nanobook.getSlug()}`,
      },
    );
    const publishingModule = await PublishingModule.create(undefined, {
      cacheNamespace: nanobookId,
    });
    const theme = await resolveEffectiveNanobookTheme(nanobook, this.themeModule.resolveTheme, request);

    return { navigationModule, publishingModule, theme };
  }
}

let appPromise: Promise<Application> | null = null;

export function getApp(): Promise<Application> {
  if (!appPromise) {
    appPromise = Application.create();
  }
  return appPromise;
}
