import type { LibSQLDatabase } from "drizzle-orm/libsql";

import type { NanobookContextModules } from "../../application/server/Application";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";
import { NanobookContext } from "./application/NanobookContext";
import { CreateNanobook } from "./application/CreateNanobook";
import type { NanobookRootInitializer } from "./application/NanobookCreationTransaction";
import { ListNanobooks } from "./application/ListNanobooks";
import { Nanobook } from "./domain/Nanobook";
import { CreateNanobookController } from "./infraestructure/rest/CreateNanobookController";
import { ListNanobooksController } from "./infraestructure/rest/ListNanobooksController";
import { DrizzleNanobookRepository } from "./infraestructure/repository/DrizzleNanobookRepository";

type Database = LibSQLDatabase<any>;

export { Nanobook } from "./domain/Nanobook";
export type { NanobookSettings, NanobookVisibility } from "./domain/types";
export { DrizzleNanobookRepository } from "./infraestructure/repository/DrizzleNanobookRepository";
export type { NanobookRepository } from "./domain/ports/NanobookRepository";
export { AuthorizeNanobook, NanobookAccessDeniedError } from "./application/AuthorizeNanobook";
export type { NanobookPermission } from "./application/AuthorizeNanobook";
export { CreateNanobook } from "./application/CreateNanobook";
export { CreateNanobookController } from "./infraestructure/rest/CreateNanobookController";
export { ListNanobooks } from "./application/ListNanobooks";
export { ListNanobooksController } from "./infraestructure/rest/ListNanobooksController";
export { NanobookContext } from "./application/NanobookContext";

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
    private readonly contextModules: NanobookContextModules,
  ) {}

  static async create(
    routeProtector: RouteProtector,
    contextModules: NanobookContextModules,
    initializeNanobookRoot: NanobookRootInitializer,
    database: Database = db,
  ): Promise<NanobookModule> {
    const repository = new DrizzleNanobookRepository(database);
    const listNanobooks = new ListNanobooks(repository);
    const createNanobook = new CreateNanobook(
      repository,
      initializeNanobookRoot,
    );

    return new NanobookModule(
      repository,
      new CreateNanobookController(createNanobook),
      new ListNanobooksController(listNanobooks),
      routeProtector,
      contextModules,
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

    const context = await NanobookContext.create(
      nanobook,
      this.routeProtector,
      this.contextModules,
    );
    this.contexts.set(nanobookId, context);
    return context;
  }
}
