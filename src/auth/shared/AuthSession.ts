export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthenticatedSessionReader {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
}
