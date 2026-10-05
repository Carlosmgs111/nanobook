import type { AuthenticatedUser } from "../../model/AuthSession";
import type { SessionReader } from "./ports/SessionReader";

export class GetAuthenticatedSession {
  constructor(private readonly sessionReader: SessionReader) {}

  execute(headers: Headers): Promise<AuthenticatedUser | null> {
    return this.sessionReader.getSession(headers);
  }
}
