export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthenticatedSessionReader {
  getCurrentUser(): Promise<AuthenticatedUser | null>;
}
