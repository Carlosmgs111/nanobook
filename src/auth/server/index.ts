import type { APIRoute } from "astro";

import { createBetterAuth } from "./infrastructure/better-auth/BetterAuth";
import { BetterAuthSessionReader } from "./infrastructure/better-auth/BetterAuthSessionReader";
import { createAuthController } from "./infrastructure/http/AuthController";
import { withAuthenticatedSession } from "./infrastructure/http/withAuthenticatedSession";

export class AuthServerModule {
  private constructor(
    private readonly sessionReader: BetterAuthSessionReader,
    public readonly authController: APIRoute
  ) {}

  static create(): AuthServerModule {
    const auth = createBetterAuth();
    const sessionReader = new BetterAuthSessionReader(auth);

    return new AuthServerModule(
      sessionReader,
      createAuthController(auth)
    );
  }

  protect(handler: APIRoute): APIRoute {
    return withAuthenticatedSession(this.sessionReader, handler);
  }

  getSession(request: Request) {
    return this.sessionReader.getSession(request.headers);
  }
}
