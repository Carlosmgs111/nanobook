import { InMemoryEventBus } from "./shared/bus/InMemoryEventBus";
import { DocumentModule, DocumentId } from "./document";
import {
  GitHubWebhookHandler,
  WebhookController,
  PublishingModule,
} from "./publishing";
import {
  NavigationModule,
  type Crumb,
  type NavigationNode,
  type ParentEntry,
} from "./navigation";
import type { RenderedDocumentPage } from "./publishing";

export class Application {
  public readonly webhookController: WebhookController;
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
    this.webhookController = new WebhookController(githubWebhookHandler);
  }

  static async create(): Promise<Application> {
    const eventBus = new InMemoryEventBus();
    const documentModule = await DocumentModule.create(eventBus);
    const publishingModule = await PublishingModule.create(eventBus);
    publishingModule.registerEventHandlers();
    const documents = await documentModule.getAllDocuments.execute();
    const navigationModule = await NavigationModule.create(documents);
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
    const documentId = new DocumentId(slug);
    const document = await this.documentModule.getDocument.execute(documentId);
    if (!document) throw new Error("Document not found");
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
