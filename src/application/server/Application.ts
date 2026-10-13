import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { DocumentModule } from "../../documents/server";
import {
  GitHubWebhookHandler,
  GitHubWebhookController,
  PublishingModule,
} from "../../publishing/server";
import { NavigationModule } from "../../navigation/server";
import { DocumentModuleDocumentProvider } from "../../documents/server/infraestructure/navigation/DocumentModuleDocumentProvider";
import { AuthServerModule } from "../../auth/server";
import { ProfileModule } from "../../profiles/server";
import { DrizzleNanobookRepository } from "../../nanobooks/server";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { NanobookContext } from "./NanobookContext";

export class Application {
  public readonly githubWebhookController: GitHubWebhookController;
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly documentModule: DocumentModule,
    public readonly navigationModule: NavigationModule,
    public readonly publishingModule: PublishingModule,
    public readonly profileModule: ProfileModule,
    public readonly eventBus: InMemoryEventBus,
    private readonly nanobookRepository: DrizzleNanobookRepository,
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

  private readonly nanobookContexts = new Map<string, NanobookContext>();

  async forNanobook(nanobookId: string): Promise<NanobookContext> {
    const result = await this.nanobookRepository.findById(nanobookId);
    if (!result.isSuccess) throw result.getError();
    const nanobook = result.getValue();
    if (!nanobook) throw new Error(`Nanobook "${nanobookId}" no existe`);

    return this.contextForNanobook(nanobook);
  }

  async forNanobookSlug(slug: string): Promise<NanobookContext | null> {
    const result = await this.nanobookRepository.findBySlug(slug);
    if (!result.isSuccess) throw result.getError();
    const nanobook = result.getValue();
    if (!nanobook) return null;
    return this.contextForNanobook(nanobook);
  }

  private async contextForNanobook(nanobook: import("../../nanobooks/server").Nanobook): Promise<NanobookContext> {
    const nanobookId = nanobook.getId();
    const cached = this.nanobookContexts.get(nanobookId);
    if (cached && cached.contentVersion === nanobook.getContentVersion()) {
      return cached;
    }
    cached?.close();

    const context = await NanobookContext.create(nanobook, this.authServerModule);
    this.nanobookContexts.set(nanobookId, context);
    return context;
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
      eventBus,
      new DrizzleNanobookRepository(db),
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
