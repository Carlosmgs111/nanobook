import type {
  AuthenticatedSessionReader,
  AuthenticatedUser,
} from "../model/AuthSession";

export class CachedAuthSessionReader implements AuthenticatedSessionReader {
  private hasCachedUser = false;
  private currentUser: AuthenticatedUser | null = null;
  private pending: Promise<AuthenticatedUser | null> | null = null;
  private revision = 0;

  constructor(private readonly source: AuthenticatedSessionReader) {}

  getCurrentUser(): Promise<AuthenticatedUser | null> {
    if (this.hasCachedUser) return Promise.resolve(this.currentUser);
    if (this.pending) return this.pending;

    const revision = this.revision;
    let pending: Promise<AuthenticatedUser | null>;
    pending = this.source.getCurrentUser().then(
      (user) => {
        if (revision !== this.revision && this.hasCachedUser) {
          return this.currentUser;
        }

        this.currentUser = user;
        this.hasCachedUser = true;
        return user;
      },
      (error) => {
        throw error;
      },
    ).finally(() => {
      if (this.pending === pending) this.pending = null;
    });
    this.pending = pending;
    return pending;
  }

  setCurrentUser(user: AuthenticatedUser): void {
    this.revision += 1;
    this.currentUser = user;
    this.hasCachedUser = true;
    this.pending = null;
  }

  clearCurrentUser(): void {
    this.revision += 1;
    this.currentUser = null;
    this.hasCachedUser = true;
    this.pending = null;
  }
}
