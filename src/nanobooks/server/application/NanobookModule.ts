import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Document } from "../../../documents/server/domain/Document";
import { DrizzleContentRepository } from "../../../documents/server/infraestructure/repository/DrizzleContentRepository";
import { UnifiedDocumentParser } from "../../../documents/server/infraestructure/parse/DocumentParser";
import {
  type RouteProtector,
} from "../../../documents/server/infraestructure/rest/protectDocumentMutationRoutes";
import { db } from "../../../shared/infrastructure/database/drizzleDatabase";
import { NanobookContext } from "./NanobookContext";
import { CreateNanobook } from "./CreateNanobook";
import type { NanobookCreationTransaction } from "./NanobookCreationTransaction";
import { ListNanobooks } from "./ListNanobooks";
import { Nanobook } from "../domain/Nanobook";
import {
  CreateNanobookController,
} from "../infraestructure/rest/CreateNanobookController";
import {
  ListNanobooksController,
} from "../infraestructure/rest/ListNanobooksController";
import { DrizzleNanobookRepository } from "../infraestructure/repository/DrizzleNanobookRepository";

type Database = LibSQLDatabase<any>;

/**
 * Composición de las capacidades globales y contextuales de nanobooks.
 *
 * El repositorio, los casos de uso y los controladores son globales. Cada
 * nanobook obtiene un NanobookContext aislado con sus documentos,
 * navegación, eventos y publicación.
 */
export class NanobookModule {
  private readonly contexts = new Map<string, NanobookContext>();

  private constructor(
    public readonly repository: DrizzleNanobookRepository,
    public readonly createNanobookController: CreateNanobookController,
    public readonly listNanobooksController: ListNanobooksController,
    private readonly routeProtector: RouteProtector,
  ) {}

  static async create(
    routeProtector: RouteProtector,
    database: Database = db,
  ): Promise<NanobookModule> {
    const repository = new DrizzleNanobookRepository(database);
    const listNanobooks = new ListNanobooks(repository);
    const initializeRoot = createRootInitializer(database);
    const createNanobook = new CreateNanobook(
      repository,
      initializeRoot,
      repository.createAtomically.bind(repository),
    );

    return new NanobookModule(
      repository,
      new CreateNanobookController(createNanobook),
      new ListNanobooksController(listNanobooks),
      routeProtector,
    );
  }

  async forNanobook(nanobookId: string): Promise<NanobookContext> {
    const result = await this.repository.findById(nanobookId);
    if (!result.isSuccess) throw result.getError();
    const nanobook = result.getValue();
    if (!nanobook) throw new Error(`Nanobook "${nanobookId}" no existe`);

    return this.contextForNanobook(nanobook);
  }

  async forNanobookSlug(slug: string): Promise<NanobookContext | null> {
    const result = await this.repository.findBySlug(slug);
    if (!result.isSuccess) throw result.getError();
    const nanobook = result.getValue();
    if (!nanobook) return null;

    return this.contextForNanobook(nanobook);
  }

  listNanobooks(ownerId: string) {
    return this.repository.listByOwner(ownerId);
  }

  close(): void {
    for (const context of this.contexts.values()) context.close();
    this.contexts.clear();
  }

  private async contextForNanobook(nanobook: Nanobook): Promise<NanobookContext> {
    const nanobookId = nanobook.getId();
    const cached = this.contexts.get(nanobookId);
    if (cached && cached.contentVersion === nanobook.getContentVersion()) {
      return cached;
    }
    cached?.close();

    const context = await NanobookContext.create(nanobook, this.routeProtector);
    this.contexts.set(nanobookId, context);
    return context;
  }
}

function createRootInitializer(database: Database) {
  return async (
    nanobook: Nanobook,
    transaction?: NanobookCreationTransaction,
  ): Promise<void> => {
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
      database,
      nanobook.getId(),
      new UnifiedDocumentParser(),
    );
    const created = await repository.create(document.getValue());
    if (!created.isSuccess) throw created.getError();
  };
}
