import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { DocumentModule } from "../../documents/server";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import { CreateNanobook } from "./application/CreateNanobook";
import { UpdateNanobook } from "./application/UpdateNanobook";
import { SetNanobookTheme } from "./application/SetNanobookTheme";
import { DeleteNanobook } from "./application/DeleteNanobook";
import { NanobookLifecycleController } from "./infraestructure/rest/NanobookLifecycleController";
import { GetNanobookBySlug } from "./application/GetNanobookBySlug";
import { ListNanobooks } from "./application/ListNanobooks";
import { ListPublicNanobooks } from "./application/ListPublicNanobooks";
import { RequireNanobookAccess } from "./application/RequireNanobookAccess";
import { AuthorizeNanobook } from "./application/AuthorizeNanobook";
import { CreateNanobookController } from "./infraestructure/rest/CreateNanobookController";
import { ListNanobooksController } from "./infraestructure/rest/ListNanobooksController";
import { DrizzleNanobookRepository } from "./infraestructure/repository/DrizzleNanobookRepository";

export { Nanobook } from "./domain/Nanobook";
export type {
  NanobookSettings,
  NanobookSetupStatus,
  NanobookVisibility,
} from "./domain/types";
export {
  AuthorizeNanobook,
  NanobookAccessDeniedError,
} from "./application/AuthorizeNanobook";
export type { NanobookPermission } from "./application/AuthorizeNanobook";
export { NanobookNotFoundError } from "./application/errors";
export { RequireNanobookAccess } from "./application/RequireNanobookAccess";

export class NanobookModule {
  private constructor(
    public readonly createNanobook: CreateNanobook,
    public readonly updateNanobook: UpdateNanobook,
    public readonly createNanobookController: CreateNanobookController,
    public readonly getNanobookBySlug: GetNanobookBySlug,
    public readonly listNanobooks: ListNanobooks,
    public readonly listNanobooksController: ListNanobooksController,
    public readonly documentModule: DocumentModule,
    public readonly lifecycleController: NanobookLifecycleController,
    public readonly listPublicNanobooks: ListPublicNanobooks,
    public readonly setNanobookTheme: SetNanobookTheme,
    public readonly requireNanobookAccess: RequireNanobookAccess
  ) {}

  static async create(eventBus: EventBus): Promise<NanobookModule> {
    const repository = new DrizzleNanobookRepository(db);
    const listNanobooks = new ListNanobooks(repository);
    const getNanobookBySlug = new GetNanobookBySlug(repository);
    const documentModule = await DocumentModule.create(eventBus);
    const createNanobook = new CreateNanobook(repository, documentModule);
    const updateNanobook = new UpdateNanobook(repository);
    const deleteNanobook = new DeleteNanobook(repository);
    const authorizeNanobook = new AuthorizeNanobook();

    return new NanobookModule(
      createNanobook,
      updateNanobook,
      new CreateNanobookController(createNanobook),
      getNanobookBySlug,
      listNanobooks,
      new ListNanobooksController(listNanobooks),
      documentModule,
      new NanobookLifecycleController(updateNanobook, deleteNanobook),
      new ListPublicNanobooks(repository),
      new SetNanobookTheme(repository),
      new RequireNanobookAccess(repository, authorizeNanobook)
    );
  }
}
