import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { DocumentModule } from "../../documents/server";
import { PublishingModule } from "../../publishing/server";
import { NavigationModule } from "../../navigation/server";
import { DocumentModuleDocumentProvider } from "../../documents/server/infraestructure/navigation/DocumentModuleDocumentProvider";
import { AuthServerModule } from "../../auth/server";
import { ProfileModule } from "../../profiles/server";
import {
  CreateNanobook,
  CreateNanobookController,
  DrizzleNanobookAliasRepository,
  DrizzleNanobookRepository,
  ListNanobooks,
  ListNanobooksController,
} from "../../nanobooks/server";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { NanobookContext } from "./NanobookContext";
import { DrizzleContentRepository } from "../../documents/server/infraestructure/repository/DrizzleContentRepository";
import { UnifiedDocumentParser } from "../../documents/server/infraestructure/parse/DocumentParser";
import { Document } from "../../documents/server/domain/Document";
import type { NanobookCreationTransaction } from "../../nanobooks/server/application/NanobookCreationTransaction";

export class Application {
  public readonly createNanobookController: CreateNanobookController;
  public readonly listNanobooksController: ListNanobooksController;
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly documentModule: DocumentModule,
    public readonly navigationModule: NavigationModule,
    public readonly publishingModule: PublishingModule,
    public readonly profileModule: ProfileModule,
    public readonly eventBus: InMemoryEventBus,
    private readonly nanobookRepository: DrizzleNanobookRepository,
    private readonly nanobookAliasRepository: DrizzleNanobookAliasRepository,
    createNanobookController: CreateNanobookController,
    listNanobooksController: ListNanobooksController,
  ) {
    this.createNanobookController = createNanobookController;
    this.listNanobooksController = listNanobooksController;
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

  async resolveNanobookAlias(path: string) {
    const result = await this.nanobookAliasRepository.findByLegacyPath(path);
    if (!result.isSuccess) throw result.getError();
    return result.getValue();
  }

  async listNanobooks(ownerId: string) {
    return this.nanobookRepository.listByOwner(ownerId);
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
    // La composición global solo satisface consumidores heredados. El
    // contenido real siempre se resuelve mediante NanobookContext y SQL.
    const documentModule = await DocumentModule.create(eventBus, authModule, {
      source: "memory",
    });
    const documentProvider = new DocumentModuleDocumentProvider(documentModule);
    const navigationModule = await NavigationModule.create(
      documentProvider,
      eventBus
    );

    const nanobookRepository = new DrizzleNanobookRepository(db);
    const nanobookAliasRepository = new DrizzleNanobookAliasRepository(db);
    const listNanobooks = new ListNanobooks(nanobookRepository);
    return new Application(
      authModule,
      documentModule,
      navigationModule,
      publishingModule,
      profileModule,
      eventBus,
      nanobookRepository,
      nanobookAliasRepository,
      new CreateNanobookController(new CreateNanobook(
        nanobookRepository,
        async (nanobook, transaction?: NanobookCreationTransaction) => {
          const document = Document.create("index", {
            id: crypto.randomUUID(),
            title: nanobook.getName(),
            description: nanobook.getName(),
            ownerId: nanobook.getOwnerId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            author: nanobook.getOwnerId(),
          }, `# ${nanobook.getName()}\n`);
          if (!document.isSuccess) throw document.getError();
          if (transaction) {
            const root = document.getValue();
            await transaction.insertDocument(root);
            await transaction.appendRevision({
              documentId: root.getDocumentId().getValue(),
              revision: root.getRevision(),
              snapshot: root.parse(),
              actorId: nanobook.getOwnerId(),
              operation: "create",
            });
            await transaction.incrementContentVersion();
            await transaction.enqueueEvent("document.created", {
              documentId: root.getDocumentId().getValue(),
            });
            return;
          }

          const repository = new DrizzleContentRepository(
            db,
            nanobook.getId(),
            new UnifiedDocumentParser(),
          );
          const created = await repository.create(document.getValue());
          if (!created.isSuccess) throw created.getError();
        },
        nanobookRepository.createAtomically.bind(nanobookRepository),
      )),
      new ListNanobooksController(listNanobooks),
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
