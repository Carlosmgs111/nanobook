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
}

export class AuthApiError extends Error {
  readonly name = "AuthApiError";

  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class HttpAuthApi implements AuthApi {
  constructor(private readonly baseUrl = "/api/auth") {}

  signIn(request: SignInRequest): Promise<AuthenticatedUser> {
    return this.post("/sign-in/email", request);
  }

  signUp(request: SignUpRequest): Promise<AuthenticatedUser> {
    return this.post("/sign-up/email", request);
  }

  private async post(
    path: string,
    body: SignInRequest | SignUpRequest
  ): Promise<AuthenticatedUser> {
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

      console.log({ payload });

      if (!response.ok) {
        throw new AuthApiError(readErrorMessage(payload), response.status);
      }

      return readUser(payload, response.status);
    } catch (error: any) {
      throw new AuthApiError("No fue posible autenticarte.", error.message);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
