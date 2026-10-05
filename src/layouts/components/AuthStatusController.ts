import type { GetAuthenticatedSession } from "../../auth/browser";

export class AuthStatusController {
  private readonly root =
    document.querySelectorAll<HTMLElement>("[data-auth-header]")[0];

  constructor(
    private readonly getAuthenticatedSession: GetAuthenticatedSession
  ) {}

  async mount(): Promise<void> {
    const profile = this.root.querySelector<HTMLElement>("[data-auth-profile]");
    const login = this.root.querySelector<HTMLElement>("[data-auth-login]");
    const user = await this.getAuthenticatedSession.execute();

    if (!user) {
      if (profile) profile.hidden = true;
      if (login) login.hidden = false;
      return;
    }

    if (profile) {
      profile.textContent = user.name;
      profile.hidden = false;
    }
    if (login) login.hidden = true;
  }
}
