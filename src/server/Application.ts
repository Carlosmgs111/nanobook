import { InMemoryEventBus } from "../shared/infrastructure/InMemoryEventBus";
import { DocumentModule } from "./documents";
import { DocumentPath } from "./documents/domain/DocumentPath";
import {
  GitHubWebhookHandler,
  GitHubWebhookController,
  PublishingModule,
} from "./publishing";
import { NavigationModule } from "./navigation";
import type { Crumb, NavigationNode, ParentEntry } from "./navigation";
import type { RenderedDocumentPage } from "./publishing";
import { DocumentModuleDocumentProvider } from "./documents/infraestructure/navigation/DocumentModuleDocumentProvider";
import { AuthServerModule } from "./auth";
import { ProfileModule } from "./profiles";

export class Application {
  public readonly githubWebhookController: GitHubWebhookController;
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly documentModule: DocumentModule,
    public readonly navigationModule: NavigationModule,
    public readonly publishingModule: PublishingModule,
    public readonly profileModule: ProfileModule,
    public readonly eventBus: InMemoryEventBus
  ) {
    const githubWebhookHandler = new GitHubWebhookHandler(
      this.publishingModule.renderedPageCache,
      this.navigationModule.navigationService,
      () => this.navigationModule.refresh()
    );
    this.githubWebhookController = new GitHubWebhookController(
      githubWebhookHandler
    );
  }

  static async create(): Promise<Application> {
    const eventBus = new InMemoryEventBus();
    const publishingModule = await PublishingModule.create(eventBus);
    publishingModule.registerEventHandlers();
    const authModule = await AuthServerModule.create();
    const profileModule = ProfileModule.create(authModule);
    const documentModule = await DocumentModule.create(eventBus, authModule);
    const documentProvider = new DocumentModuleDocumentProvider(documentModule);
    const navigationModule = await NavigationModule.create(
      documentProvider,
      eventBus
    );

    return new Application(
      authModule,
      documentModule,
      navigationModule,
      publishingModule,
      profileModule,
      eventBus
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
