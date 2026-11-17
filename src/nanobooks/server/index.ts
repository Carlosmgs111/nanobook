import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { DocumentModule } from "../../documents/server";
import type { Authorizer, Policy } from "../../authorization/server";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import { NanobookAccessPolicy } from "./application/access/NanobookAccessPolicy";
import { CreateNanobook } from "./application/CreateNanobook";
import { UpdateNanobook } from "./application/UpdateNanobook";
import { SetNanobookTheme } from "./application/SetNanobookTheme";
import { DeleteNanobook } from "./application/DeleteNanobook";
import { NanobookLifecycleController } from "./infraestructure/rest/NanobookLifecycleController";
import { GetNanobookBySlug } from "./application/GetNanobookBySlug";
import { GetNanobookById } from "./application/GetNanobookById";
import { ListNanobooks } from "./application/ListNanobooks";
import { ListPublicNanobooks } from "./application/ListPublicNanobooks";
import { CreateNanobookController } from "./infraestructure/rest/CreateNanobookController";
import { ListNanobooksController } from "./infraestructure/rest/ListNanobooksController";
import { DrizzleNanobookRepository } from "./infraestructure/repository/DrizzleNanobookRepository";
import { createNanobookReadCache } from "./infraestructure/cache/createNanobookReadCache";

export { Nanobook } from "./domain/Nanobook";
export type {
  NanobookSettings,
  NanobookSetupStatus,
  NanobookVisibility,
} from "./domain/types";
export { NanobookNotFoundError } from "./domain/errors";

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
    public readonly getNanobookById: GetNanobookById
  ) {}

  static async create(
    eventBus: EventBus,
    authorizer: Authorizer,
    policies: Policy[],
  ): Promise<NanobookModule> {
    const repository = new DrizzleNanobookRepository(db);
    policies.push(new NanobookAccessPolicy(repository));
    const readCache = createNanobookReadCache();
    const listNanobooks = new ListNanobooks(repository);
    const getNanobookBySlug = new GetNanobookBySlug(repository, readCache);
    const documentModule = await DocumentModule.create(eventBus, authorizer, policies);
    const createNanobook = new CreateNanobook(repository, documentModule, readCache);
    const updateNanobook = new UpdateNanobook(repository, readCache, authorizer);
    const deleteNanobook = new DeleteNanobook(repository, readCache, authorizer);

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
      new SetNanobookTheme(repository, readCache, authorizer),
      new GetNanobookById(repository)
    );
  }
}
