import type { AuthenticatedUser } from "./model/AuthSession";

export type { AuthenticatedUser } from "./model/AuthSession";

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignUpRequest extends SignInRequest {
  name: string;
}

export interface AuthApi {
  signIn(request: SignInRequest): Promise<AuthenticatedUser>;
  signUp(request: SignUpRequest): Promise<AuthenticatedUser>;
  signInWithGitHub(): Promise<SocialAuthorization>;
  signOut(): Promise<void>;
}

export interface SocialAuthorization {
  authorizationUrl: string;
}

export class AuthApiError extends Error {
  readonly name = "AuthApiError";

  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class HttpAuthApi implements AuthApi {
  private readonly baseUrl = "/api/auth";

  async signIn(request: SignInRequest): Promise<AuthenticatedUser> {
    const { payload, status } = await this.postJson("/sign-in/email", request);
    return readUser(payload, status);
  }

  signUp(request: SignUpRequest): Promise<AuthenticatedUser> {
    return this.postUser("/sign-up/email", { ...request, callbackURL: "/" });
  }

  async signInWithGitHub(): Promise<SocialAuthorization> {
    const { payload, status } = await this.postJson("/sign-in/social", {
      provider: "github",
      callbackURL: "/",
      disableRedirect: true,
    });

    return readAuthorizationUrl(payload, status);
  }

  async signOut(): Promise<void> {
    await this.postJson("/sign-out", {});
  }

  private async postUser(
    path: string,
    body: SignInRequest | SignUpRequest,
  ): Promise<AuthenticatedUser> {
    const { payload, status } = await this.postJson(path, body);
    return readUser(payload, status);
  }

  private async postJson(
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ payload: unknown; status: number }> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await parseJson(response);

      if (!response.ok) {
        throw new AuthApiError(readErrorMessage(payload), response.status);
      }

      return { payload, status: response.status };
    } catch (error) {
      console.error(error);
      if (error instanceof AuthApiError) throw error;
      throw new AuthApiError("No fue posible autenticarte. 🙃", 0);
    }
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readErrorMessage(payload: unknown): string {
  if (isRecord(payload) && typeof payload.message === "string") {
    return payload.message;
  }
  return "No fue posible autenticarte.";
}

function readUser(payload: unknown, status: number): AuthenticatedUser {
  if (!isRecord(payload) || !isRecord(payload.user)) {
    throw new AuthApiError("Respuesta de autenticación inválida. 1️⃣", status);
  }

  const { id, name, email } = payload.user;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof email !== "string"
  ) {
    throw new AuthApiError("Respuesta de autenticación inválida. 2️⃣", status);
  }

  return { id, name, email };
}

function readAuthorizationUrl(
  payload: unknown,
  status: number,
): SocialAuthorization {
  if (
    !isRecord(payload) ||
    payload.redirect !== false ||
    typeof payload.url !== "string" ||
    payload.url.length === 0
  ) {
    throw new AuthApiError("Respuesta de autenticación inválida.", status);
  }

  return { authorizationUrl: payload.url };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
