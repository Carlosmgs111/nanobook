import type { AuthenticatedUser } from "../../../model/AuthSession";

export interface SessionReader {
  getSession(headers: Headers): Promise<AuthenticatedUser | null>;
}
