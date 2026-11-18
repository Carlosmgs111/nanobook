import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { DocumentModule } from "../../documents/server";
import type { Authorization } from "../../authorization/server";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import { NanobookAccessPolicy } from "./infraestructure/access/NanobookAccessPolicy";
import { CreateNanobook } from "./application/CreateNanobook";
import { LifeCycle } from "./application/LifeCycle";
import { NanobookLifecycleController } from "./infraestructure/rest/NanobookLifecycleController";
import { Reading } from "./application/Reading";
import { CreateNanobookController } from "./infraestructure/rest/CreateNanobookController";
import { ListNanobooksController } from "./infraestructure/rest/ListNanobooksController";
import { DrizzleNanobookRepository } from "./infraestructure/repository/DrizzleNanobookRepository";
import { DocumentModuleRootDocument } from "./infraestructure/documents/DocumentModuleRootDocument";
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
    public readonly updateNanobook: LifeCycle["update"],
    public readonly createNanobookController: CreateNanobookController,
    public readonly getNanobookBySlug: Reading["getNanobookBySlug"],
    public readonly listNanobooks: Reading["listNanobooks"],
    public readonly listNanobooksController: ListNanobooksController,
    public readonly documentModule: DocumentModule,
    public readonly lifecycleController: NanobookLifecycleController,
    public readonly listPublicNanobooks: Reading["listPublicNanobooks"],
    public readonly setNanobookTheme: LifeCycle["setNanobookTheme"],
    public readonly getNanobookById: Reading["getNanobookById"]
  ) {}

  static async create(
    eventBus: EventBus,
    authorization: Authorization
  ): Promise<NanobookModule> {
    const repository = new DrizzleNanobookRepository(db);
    authorization.register(new NanobookAccessPolicy(repository));
    const readCache = createNanobookReadCache();
    const documentModule = await DocumentModule.create(eventBus, authorization);
    const lifeCycle = new LifeCycle(repository, readCache, authorization);
    const reading = new Reading(repository, readCache);
    const createNanobook = new CreateNanobook(
      repository,
      new DocumentModuleRootDocument(documentModule),
      readCache
    );

    return new NanobookModule(
      createNanobook,
      lifeCycle.update,
      new CreateNanobookController(createNanobook),
      reading.getNanobookBySlug,
      reading.listNanobooks,
      new ListNanobooksController(reading.listNanobooks),
      documentModule,
      new NanobookLifecycleController(lifeCycle.update, lifeCycle.delete),
      reading.listPublicNanobooks,
      lifeCycle.setNanobookTheme,
      reading.getNanobookById
    );
  }
}
