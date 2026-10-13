import type { GetAuthenticatedSession } from "../../auth/browser";

export class AuthStatusController {
  constructor(
    private readonly getAuthenticatedSession: GetAuthenticatedSession
  ) {}

  async mount(): Promise<void> {
    const root = document.querySelectorAll<HTMLElement>("[data-auth-header]")[0];
    if (!root) return;

    const profile = root.querySelector<HTMLElement>("[data-auth-profile]");
    const login = root.querySelector<HTMLElement>("[data-auth-login]");
    const user = await this.getAuthenticatedSession.execute();
    const documentMutationActions = document.querySelectorAll<HTMLElement>(
      "[data-auth-document-mutation]"
    );

    documentMutationActions.forEach((action) => {
      action.hidden = !user;
    });

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
