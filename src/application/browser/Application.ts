import { AuthModule } from "../../auth/browser";
import { EditionModule } from "../../documents/browser";

export class Application {
  private constructor(
    public readonly authModule: AuthModule,
    public readonly editionModule: EditionModule,
  ) {}

  static create(): Application {
    return new Application(AuthModule.create(), EditionModule.create());
  }
}

let app: Application | null = null;

export function getApp(): Application {
  if (!app) {
    app = Application.create();
  }
  return app;
}
