import type { AuthSessionStorage } from "./LocalStorageAuthSessionStorage";

export interface AuthStatusControllerCapabilities {
  root: HTMLElement;
  sessionStorage: AuthSessionStorage;
}

export class AuthStatusController {
  constructor(private readonly capabilities: AuthStatusControllerCapabilities) {}

  mount(): void {
    const status = this.capabilities.root.querySelector<HTMLElement>("[data-auth-status]");
    const login = this.capabilities.root.querySelector<HTMLElement>("[data-auth-login]");
    const session = this.capabilities.sessionStorage.load();

    if (!session) {
      if (status) status.hidden = true;
      if (login) login.hidden = false;
      return;
    }

    if (status) {
      status.textContent = `Conectado: ${session.user.name}`;
      status.hidden = false;
    }
    if (login) login.hidden = true;
  }
}
