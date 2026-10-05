import type { APIRoute } from "astro";

import { GetAuthenticatedSession } from "./application/GetAuthenticatedSession";
import { createBetterAuth } from "./infrastructure/better-auth/BetterAuth";
import { BetterAuthSessionReader } from "./infrastructure/better-auth/BetterAuthSessionReader";
import { createAuthController } from "./infrastructure/http/AuthController";
import { withAuthenticatedSession } from "./infrastructure/http/withAuthenticatedSession";

export class AuthServerModule {
  private constructor(
    private readonly getAuthenticatedSession: GetAuthenticatedSession,
    public readonly authController: APIRoute,
  ) {}

  static create(): AuthServerModule {
    const auth = createBetterAuth();
    const getAuthenticatedSession = new GetAuthenticatedSession(
      new BetterAuthSessionReader(auth),
    );

    return new AuthServerModule(
      getAuthenticatedSession,
      createAuthController(auth),
    );
  }

  protect(handler: APIRoute): APIRoute {
    return withAuthenticatedSession(this.getAuthenticatedSession, handler);
  }
}

export const authModule = AuthServerModule.create();
