import { AuthServerModule } from "../../auth/server";
import { ProfileModule } from "../../profiles/server";
import { NanobookModule } from "../../nanobooks/server";
import type { RouteProtector } from "../../shared/server/capabilities/RouteProtector";

export class Application {
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly routeProtector: RouteProtector,
    public readonly profileModule: ProfileModule,
    public readonly nanobookModule: NanobookModule,
  ) {}

  static async create(): Promise<Application> {
    const authServerModule = await AuthServerModule.create();
    const routeProtector: RouteProtector = authServerModule;
    const profileModule = ProfileModule.create(routeProtector);
    const nanobookModule = await NanobookModule.create(routeProtector);

    return new Application(
      authServerModule,
      routeProtector,
      profileModule,
      nanobookModule,
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
