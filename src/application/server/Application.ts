import { AuthServerModule } from "../../auth/server";
import { ProfileModule } from "../../profiles/server";
import { NanobookModule } from "../../nanobooks/server";

export class Application {
  private constructor(
    public readonly authServerModule: AuthServerModule,
    public readonly profileModule: ProfileModule,
    public readonly nanobookModule: NanobookModule,
  ) {}

  static async create(): Promise<Application> {
    const authModule = await AuthServerModule.create();
    const profileModule = ProfileModule.create(authModule);
    const nanobookModule = await NanobookModule.create(authModule);

    return new Application(
      authModule,
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
