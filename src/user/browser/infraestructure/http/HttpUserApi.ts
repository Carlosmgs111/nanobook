import { Result } from "../../../../../shared/domain/Result";
import type { UserProfile } from "../../../domain/types";

export interface CreateUserApiInput {
  email: string;
  displayName: string;
  id?: string;
  createdAt?: Date;
}

export interface UpdateUserApiInput {
  email?: string;
  displayName?: string;
  id?: string;
  updatedAt?: Date;
}

export class HttpUserApiError extends Error {
  constructor(
    message: string,
    public readonly status = 0,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = "HttpUserApiError";
    this.cause = options?.cause;
  }
}

export class HttpUserApi {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch) {}

  async createUser(
    input: CreateUserApiInput
  ): Promise<Result<HttpUserApiError, UserProfile>> {
    return this.request<UserProfile>("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        displayName: input.displayName,
      }),
    });
  }

  async getUser(
    id: string
  ): Promise<Result<HttpUserApiError, UserProfile>> {
    return this.request<UserProfile>(`/api/users/${encodeURIComponent(id)}`, {
      method: "GET",
    });
  }

  async getUserByEmail(
    email: string
  ): Promise<Result<HttpUserApiError, UserProfile>> {
    const query = new URLSearchParams({ email });
    return this.request<UserProfile>(`/api/users?${query.toString()}`, {
      method: "GET",
    });
  }

  async updateUser(
    id: string,
    input: UpdateUserApiInput
  ): Promise<Result<HttpUserApiError, UserProfile>> {
    return this.request<UserProfile>(`/api/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(input.email === undefined ? {} : { email: input.email }),
        ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      }),
    });
  }

  async deleteUser(id: string): Promise<Result<HttpUserApiError, void>> {
    const result = await this.request<unknown>(`/api/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return result.isSuccess ? Result.ok() : Result.fail(result.getError());
  }

  private async request<T>(
    url: string,
    init: RequestInit
  ): Promise<Result<HttpUserApiError, T>> {
    try {
      const response = await this.fetcher(url, init);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : `Error HTTP ${response.status}`;
        return Result.fail(new HttpUserApiError(message, response.status));
      }
      return Result.ok(payload as T);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(new HttpUserApiError(message, 0, { cause: error }));
    }
  }
}
