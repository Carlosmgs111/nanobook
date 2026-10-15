import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";
import { DocumentModule } from "../../documents/server";
import { InMemoryEventBus } from "../../shared/infrastructure/InMemoryEventBus";
import { CreateNanobook } from "./application/CreateNanobook";
import { GetNanobookById } from "./application/GetNanobookById";
import { GetNanobookBySlug } from "./application/GetNanobookBySlug";
import { ListNanobooks } from "./application/ListNanobooks";
import { CreateNanobookController } from "./infraestructure/rest/CreateNanobookController";
import { ListNanobooksController } from "./infraestructure/rest/ListNanobooksController";
import { DrizzleNanobookRepository } from "./infraestructure/repository/DrizzleNanobookRepository";

export { Nanobook } from "./domain/Nanobook";
export type { NanobookSettings, NanobookSetupStatus, NanobookVisibility } from "./domain/types";
export { DrizzleNanobookRepository } from "./infraestructure/repository/DrizzleNanobookRepository";
export { InMemoryNanobookRepository } from "./infraestructure/repository/InMemoryNanobookRepository";
export type { NanobookRepository } from "./domain/ports/NanobookRepository";
export { AuthorizeNanobook, NanobookAccessDeniedError } from "./application/AuthorizeNanobook";
export type { NanobookPermission } from "./application/AuthorizeNanobook";
export { NanobookNotFoundError } from "./application/errors";

/**
 * Composición de las capacidades globales de nanobooks.
 *
 * El repositorio, los casos de uso, los controladores y el módulo documental
 * son globales. Las capacidades de presentación se construyen en la raíz de
 * aplicación para cada solicitud y nunca se indexan ni se conservan por
 * nanobook.
 */
export class NanobookModule {
  private constructor(
    public readonly createNanobook: CreateNanobook,
    public readonly createNanobookController: CreateNanobookController,
    public readonly getNanobookById: GetNanobookById,
    public readonly getNanobookBySlug: GetNanobookBySlug,
    public readonly listNanobooks: ListNanobooks,
    public readonly listNanobooksController: ListNanobooksController,
    public readonly documentModule: DocumentModule,
  ) {}

  static async create(routeProtector: RouteProtector): Promise<NanobookModule> {
    const repository = new DrizzleNanobookRepository(db);
    const listNanobooks = new ListNanobooks(repository);
    const getNanobookById = new GetNanobookById(repository);
    const getNanobookBySlug = new GetNanobookBySlug(repository);
    const documentModule = await DocumentModule.create(
      new InMemoryEventBus(),
      routeProtector,
    );
    const createNanobook = new CreateNanobook(repository, documentModule);

    return new NanobookModule(
      createNanobook,
      new CreateNanobookController(createNanobook),
      getNanobookById,
      getNanobookBySlug,
      listNanobooks,
      new ListNanobooksController(listNanobooks),
      documentModule,
    );
  }
}
