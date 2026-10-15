import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";
import { DocumentModule } from "../../documents/server";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import { CreateNanobook } from "./application/CreateNanobook";
import { UpdateNanobook } from "./application/UpdateNanobook";
import { DeleteNanobook } from "./application/DeleteNanobook";
import { NanobookLifecycleController } from "./infraestructure/rest/NanobookLifecycleController";
import { GetNanobookById } from "./application/GetNanobookById";
import { GetNanobookBySlug } from "./application/GetNanobookBySlug";
import { ListNanobooks } from "./application/ListNanobooks";
import { ListPublicNanobooks } from "./application/ListPublicNanobooks";
import { CreateNanobookController } from "./infraestructure/rest/CreateNanobookController";
import { ListNanobooksController } from "./infraestructure/rest/ListNanobooksController";
import { DrizzleNanobookRepository } from "./infraestructure/repository/DrizzleNanobookRepository";

export { Nanobook } from "./domain/Nanobook";
export type { NanobookSettings, NanobookSetupStatus, NanobookVisibility } from "./domain/types";
export { AuthorizeNanobook, NanobookAccessDeniedError } from "./application/AuthorizeNanobook";
export type { NanobookPermission } from "./application/AuthorizeNanobook";
export { NanobookNotFoundError } from "./application/errors";

export class NanobookModule {
  private constructor(
    public readonly createNanobook: CreateNanobook,
    public readonly createNanobookController: CreateNanobookController,
    public readonly getNanobookById: GetNanobookById,
    public readonly getNanobookBySlug: GetNanobookBySlug,
    public readonly listNanobooks: ListNanobooks,
    public readonly listNanobooksController: ListNanobooksController,
    public readonly documentModule: DocumentModule,
    public readonly lifecycleController: NanobookLifecycleController,
    public readonly listPublicNanobooks: ListPublicNanobooks,
  ) {}

  static async create(routeProtector: RouteProtector, eventBus: EventBus): Promise<NanobookModule> {
    const repository = new DrizzleNanobookRepository(db);
    const listNanobooks = new ListNanobooks(repository);
    const getNanobookById = new GetNanobookById(repository);
    const getNanobookBySlug = new GetNanobookBySlug(repository);
    const documentModule = await DocumentModule.create(
      eventBus,
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
      new NanobookLifecycleController(new UpdateNanobook(repository), new DeleteNanobook(repository)),
      new ListPublicNanobooks(repository),
    );
  }
}
