import { InMemoryEventBus } from "./shared/infraestructure/InMemoryEventBus";
import { DocumentModule } from "./document";
import {
  GitHubWebhookHandler,
  GitHubWebhookController,
  PublishingModule,
} from "./publishing";
import { NavigationModule } from "./navigation";
import type { Crumb, NavigationNode, ParentEntry } from "./navigation";
import type { RenderedDocumentPage } from "./publishing";
import { DocumentModuleDocumentProvider } from "./document/infraestructure/navigation/DocumentModuleDocumentProvider";

export class Application {
  public readonly githubWebhookController: GitHubWebhookController;
  private constructor(
    public readonly documentModule: DocumentModule,
    public readonly navigationModule: NavigationModule,
    public readonly publishingModule: PublishingModule,
    public readonly eventBus: InMemoryEventBus
  ) {
    const githubWebhookHandler = new GitHubWebhookHandler(
      this.publishingModule.renderedPageCache,
      this.navigationModule.navigationService
    );
    this.githubWebhookController = new GitHubWebhookController(githubWebhookHandler);
  }

  static async create(): Promise<Application> {
    const eventBus = new InMemoryEventBus();
    const publishingModule = await PublishingModule.create(eventBus);
    publishingModule.registerEventHandlers()
    const documentModule = await DocumentModule.create(eventBus);
    const documentProvider = new DocumentModuleDocumentProvider(documentModule);
    const navigationModule = await NavigationModule.create(documentProvider);

    return new Application(
      documentModule,
      navigationModule,
      publishingModule,
      eventBus
    );
  }

  async renderPage(slug: string): Promise<
    {
      breadcrumbs: Crumb[];
      sidebarEntries: NavigationNode[];
      parentEntry: ParentEntry | null;
      childEntries: NavigationNode[];
    } & RenderedDocumentPage
  > {
    const document = await this.documentModule.getDocument.execute(slug);
    if (!document) throw new Error("Document not found");
    const documentId = document.getId();
    const breadcrumbs =
      this.navigationModule.navigationService.getBreadcrumbs(documentId);
    const sidebarEntries =
      this.navigationModule.navigationService.getSidebarEntries(documentId);
    const parentEntry =
      this.navigationModule.navigationService.getParentEntry(documentId);
    const childEntries =
      this.navigationModule.navigationService.getImmediateChildren(documentId);
    const renderedPage = await this.publishingModule.pagePublisher.publish(
      document
    );
    if (!renderedPage) throw new Error("Page not found");
    return {
      ...renderedPage,
      breadcrumbs,
      sidebarEntries,
      parentEntry,
      childEntries,
    };
  }
}

let appPromise: Promise<Application> | null = null;

export function getApp(): Promise<Application> {
  if (!appPromise) {
    appPromise = Application.create();
  }
  return appPromise;
}
