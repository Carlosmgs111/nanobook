import type { ToastNotifier } from "../../toast/browser/BrowserToastNotifier";

export class SignOutController {
  constructor(
    private readonly signOut: { execute(): Promise<void> },
    private readonly notifier: ToastNotifier,
  ) {}

  mount(): void {
    const button = document.querySelector<HTMLButtonElement>("[data-sign-out]");
    if (!button || button.dataset.signOutReady === "true") return;
    button.dataset.signOutReady = "true";
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        await this.signOut.execute();
      } catch {
        this.notifier.show("No fue posible cerrar sesión. Inténtalo de nuevo.", "error");
      } finally {
        button.disabled = false;
      }
    });
  }
}
