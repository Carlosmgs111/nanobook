import { AuthServerModule } from "../../auth/server";
import { createAuthorizer, type Authorizer } from "../../authorization/server";
import { createMarkdownExtensions } from "../shared/createMarkdownExtensions";
import { createMarkdownBlockAdvisor } from "./createMarkdownBlockAdvisor";
import { ProfileModule } from "../../profiles/server";
import { NanobookModule } from "../../nanobooks/server";
import { NavigationModule } from "../../navigation/server";
import { PublishingModule } from "../../publishing/server";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { ThemeModule } from "../../theme/server";
import { AgentModule } from "../../agents/server";

export class Application {
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly routeProtector: RouteProtector,
    public readonly profileModule: ProfileModule,
    public readonly nanobookModule: NanobookModule,
    public readonly navigationModule: NavigationModule,
    public readonly publishingModule: PublishingModule,
    public readonly themeModule: ThemeModule,
    public readonly agentModule: AgentModule,
    public readonly authorizer: Authorizer,
  ) {}

  static async create(): Promise<Application> {
    const authServerModule = await AuthServerModule.create();
    const routeProtector: RouteProtector = authServerModule;
    const profileModule = ProfileModule.create(routeProtector);
    const eventBus = new InMemoryEventBus();
    // Cada módulo registra su política en el autorizador al crearse.
    const authorization = createAuthorizer();
    const authorizer: Authorizer = authorization;
    const nanobookModule = await NanobookModule.create(eventBus, authorization);
    const navigationModule = await NavigationModule.create(
      nanobookModule.documentModule,
      eventBus,
    );
    const markdownExtensions = createMarkdownExtensions();
    const publishingModule = await PublishingModule.create(eventBus, markdownExtensions);
    const themeModule = ThemeModule.create(
      routeProtector,
      nanobookModule.setNanobookTheme,
    );
    const agentModule = AgentModule.create(nanobookModule, createMarkdownBlockAdvisor(), authorizer);
    return new Application(
      authServerModule,
      routeProtector,
      profileModule,
      nanobookModule,
      navigationModule,
      publishingModule,
      themeModule,
      agentModule,
      authorizer,
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
