export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

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
}

export interface SocialAuthorization {
  authorizationUrl: string;
}

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class AuthApiError extends Error {
  readonly name = "AuthApiError";

  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class HttpAuthApi implements AuthApi {
  constructor(
    private readonly fetcher: FetchLike = globalThis.fetch,
    private readonly baseUrl = "/api/auth",
  ) {}

  signIn(request: SignInRequest): Promise<AuthenticatedUser> {
    return this.post("/sign-in/email", request);
  }

  signUp(request: SignUpRequest): Promise<AuthenticatedUser> {
    return this.post("/sign-up/email", request);
  }

  async signInWithGitHub(): Promise<SocialAuthorization> {
    const { payload, status } = await this.postJson("/sign-in/social", {
      provider: "github",
      callbackURL: "/",
      disableRedirect: true,
    });

    return readAuthorizationUrl(payload, status);
  }

  private async post(
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
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
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
      if (error instanceof AuthApiError) throw error;
      throw new AuthApiError("No fue posible autenticarte.", 0);
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
    throw new AuthApiError("Respuesta de autenticación inválida.", status);
  }

  const { id, name, email } = payload.user;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof email !== "string"
  ) {
    throw new AuthApiError("Respuesta de autenticación inválida.", status);
  }

  return { id, name, email };
}

function readAuthorizationUrl(
  payload: unknown,
  status: number,
): SocialAuthorization {
  if (
    !isRecord(payload) ||
    payload.redirect !== true ||
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
