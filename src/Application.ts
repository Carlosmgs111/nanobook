import { Result } from "./shared/utils/result";
import { InMemoryEventBus } from "./shared/bus/InMemoryEventBus";
import { DocumentModule, DocumentId, type DocumentChangeNotifier } from "./document";
import { DocumentNotificationError } from "./document/infraestructure/errors";
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

    // Publicar primero para poder construir el notifier de documentos sin
    // crear un ciclo de inicialización.
    const publishingModule = await PublishingModule.create(eventBus);

    const documentChangeNotifier: DocumentChangeNotifier = {
      onDocumentCreated: async (documentId) => {
        try {
          const result = await publishingModule.pagePublisher.invalidate([
            documentId,
          ]);
          if (!result.isSuccess) {
            return Result.fail(
              new DocumentNotificationError(
                `Failed to notify document creation: ${result.getError().message}`,
                { cause: result.getError() }
              )
            );
          }
          return Result.ok();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return Result.fail(
            new DocumentNotificationError(
              `Failed to notify document creation: ${message}`,
              { cause: error }
            )
          );
        }
      },
      onDocumentUpdated: async (documentId) => {
        try {
          const result = await publishingModule.pagePublisher.invalidate([
            documentId,
          ]);
          if (!result.isSuccess) {
            return Result.fail(
              new DocumentNotificationError(
                `Failed to notify document update: ${result.getError().message}`,
                { cause: result.getError() }
              )
            );
          }
          return Result.ok();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return Result.fail(
            new DocumentNotificationError(
              `Failed to notify document update: ${message}`,
              { cause: error }
            )
          );
        }
      },
    };

    const documentModule = await DocumentModule.create(
      eventBus,
      documentChangeNotifier
    );

    // La invalidación de caché ahora se hace de forma síncrona a través del
    // notifier. El bus sigue disponible para efectos secundarios futuros.
    // publishingModule.registerEventHandlers();

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
