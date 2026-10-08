import type { APIRoute } from "astro";
import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import { CreateCurrentProfile } from "./application/CreateCurrentProfile";
import { GetCurrentProfile } from "./application/GetCurrentProfile";
import { GetPublicProfileByUsername } from "./application/GetPublicProfileByUsername";
import { UpdateCurrentProfile } from "./application/UpdateCurrentProfile";
import { CreateCurrentProfileController } from "./infraestructure/rest/CreateCurrentProfileController";
import { GetCurrentProfileController } from "./infraestructure/rest/GetCurrentProfileController";
import { GetPublicProfileController } from "./infraestructure/rest/GetPublicProfileController";
import { UpdateCurrentProfileController } from "./infraestructure/rest/UpdateCurrentProfileController";
import { DrizzleProfileRepository } from "./infraestructure/repository/DrizzleProfileRepository";

export interface RouteProtector { protect(route: APIRoute): APIRoute; }

export class ProfileModule {
  private constructor(
    public readonly createCurrentProfileController: CreateCurrentProfileController,
    public readonly getCurrentProfileController: GetCurrentProfileController,
    public readonly updateCurrentProfileController: UpdateCurrentProfileController,
    public readonly getPublicProfileController: GetPublicProfileController,
    public readonly privateProfileRoutes: { GET: APIRoute; POST: APIRoute; PATCH: APIRoute },
  ) {}

  static create(routeProtector: RouteProtector): ProfileModule {
    const repository = new DrizzleProfileRepository(db);
    const createCurrentProfileController = new CreateCurrentProfileController(new CreateCurrentProfile(repository));
    const getCurrentProfileController = new GetCurrentProfileController(new GetCurrentProfile(repository));
    const updateCurrentProfileController = new UpdateCurrentProfileController(new UpdateCurrentProfile(repository));
    return new ProfileModule(createCurrentProfileController, getCurrentProfileController, updateCurrentProfileController, new GetPublicProfileController(new GetPublicProfileByUsername(repository)), {
      GET: routeProtector.protect(getCurrentProfileController.handle),
      POST: routeProtector.protect(createCurrentProfileController.handle),
      PATCH: routeProtector.protect(updateCurrentProfileController.handle),
    });
  }
}
