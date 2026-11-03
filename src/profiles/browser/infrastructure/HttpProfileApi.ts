export interface Profile {
  username: string;
  displayName: string;
}

export interface CreateProfileInput {
  username: string;
  displayName: string;
}

export interface UpdateProfileInput {
  displayName: string;
}

export class ProfileApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ProfileApiError";
  }
}

export class HttpProfileApi {
  async getCurrent(): Promise<Profile> {
    return this.request("GET");
  }

  async create(input: CreateProfileInput): Promise<Profile> {
    return this.request("POST", input);
  }

  async update(input: UpdateProfileInput): Promise<Profile> {
    return this.request("PATCH", input);
  }

  private async request(method: "GET" | "POST" | "PATCH", body?: object): Promise<Profile> {
    const response = await fetch("/api/me/profile", {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await readJson(response);
    if (!response.ok) throw new ProfileApiError(readError(payload), response.status);
    if (!isProfile(payload)) throw new ProfileApiError("Respuesta de perfil inválida", response.status);
    return payload;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try { return await response.json(); } catch { return undefined; }
}

function readError(value: unknown): string {
  return typeof value === "object" && value !== null && typeof (value as any).error === "string" ? (value as any).error : "No fue posible actualizar el perfil";
}

function isProfile(value: unknown): value is Profile {
  return typeof value === "object" && value !== null && typeof (value as any).username === "string" && typeof (value as any).displayName === "string";
}
