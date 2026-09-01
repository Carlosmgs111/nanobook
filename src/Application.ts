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
  public webhookController: WebhookController;
  private constructor(
    public documentModule: DocumentModule,
    public navigationModule: NavigationModule,
    public publishingModule: PublishingModule
  ) {
    const githubWebhookHandler = new GitHubWebhookHandler(
      this.publishingModule.renderedPageCache,
      this.navigationModule.navigationService
    );
    this.webhookController = new WebhookController(githubWebhookHandler);
  }

  static async create(): Promise<Application> {
    const documentModule = await DocumentModule.create();
    const publishingModule = await PublishingModule.create();
    const documents = await documentModule.getAllDocuments.execute();
    const navigationModule = await NavigationModule.create(documents);
    return new Application(documentModule, navigationModule, publishingModule);
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
    // console.log({ document });
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
    // console.log({ renderedPage });
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
