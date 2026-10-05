import type { GetAuthenticatedSession } from "../../auth/browser";

export class AuthStatusController {
  private readonly root =
    document.querySelectorAll<HTMLElement>("[data-auth-header]")[0];

  constructor(
    private readonly getAuthenticatedSession: GetAuthenticatedSession
  ) {}

  async mount(): Promise<void> {
    const status = this.root.querySelector<HTMLElement>("[data-auth-status]");
    const login = this.root.querySelector<HTMLElement>("[data-auth-login]");
    const user = await this.getAuthenticatedSession.execute();

    if (!user) {
      if (status) status.hidden = true;
      if (login) login.hidden = false;
      return;
    }

    if (status) {
      status.textContent = `Conectado: ${user.name}`;
      status.hidden = false;
    }
    if (login) login.hidden = true;
  }
}
