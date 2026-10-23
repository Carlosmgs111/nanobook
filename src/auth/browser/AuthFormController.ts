import { navigate as defaultNavigate } from "astro:transitions/client";

import type { AuthApi } from "./HttpAuthApi";
import type { ToastNotifier } from "../../toast/browser/BrowserToastNotifier";

type AuthFormMode = "login" | "signup";

export interface AuthFormControllerOptions {
  authApi: AuthApi;
  notifier: Pick<ToastNotifier, "show">;
  root?: HTMLElement;
  navigate?: (destination: string) => void;
}

class AuthFormModeCapability {
  isVisible(fieldMode: string | undefined, selectedMode: AuthFormMode): boolean {
    return fieldMode === selectedMode;
  }
}

const copyByMode: Record<AuthFormMode, string> = {
  login: "Ingresa para volver a tus documentos.",
  signup: "Guarda tu espacio de escritura en un solo lugar.",
};

const titleByMode: Record<AuthFormMode, string> = {
  login: "Bienvenido de nuevo",
  signup: "Crea tu cuenta",
};

const submitLabelByMode: Record<AuthFormMode, string> = {
  login: "Ingresar",
  signup: "Crear cuenta",
};

const eyebrowByMode: Record<AuthFormMode, string> = {
  login: "TU ESPACIO TE ESPERA",
  signup: "EMPIEZA TU CUADERNO",
};

export class AuthFormController {
  private readonly formMode = new AuthFormModeCapability();
  private readonly navigate: (destination: string) => void;
  private root: HTMLElement | undefined;

  constructor(private readonly options: AuthFormControllerOptions) {
    this.root = options.root;
    this.navigate = options.navigate ?? defaultNavigate;
  }

  mount(): void {
    const root = this.getRoot();
    if (!root || root.dataset.authFormReady === "true") return;
    root.dataset.authFormReady = "true";

    root.querySelectorAll<HTMLButtonElement>("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        this.setMode(this.readMode(button.dataset.authMode));
      });
    });

    root
      .querySelector<HTMLFormElement>(".auth-form__fields")
      ?.addEventListener("submit", (event) => void this.submit(event));

    const githubButton = root.querySelector<HTMLButtonElement>(
      '[data-auth-provider="github"]',
    );
    githubButton?.addEventListener("click", () => {
      void this.submitGitHub(githubButton);
    });

    this.setMode(this.readMode(root.dataset.mode));
  }

  private getRoot(): HTMLElement | undefined {
    if (!this.root) {
      this.root = document.querySelectorAll<HTMLElement>("[data-auth-form]")[0];
    }
    return this.root;
  }

  private setMode(mode: AuthFormMode): void {
    const root = this.getRoot();
    if (!root) return;
    root.dataset.mode = mode;

    root.querySelectorAll<HTMLElement>("[data-auth-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.authMode === mode));
    });

    root.querySelectorAll<HTMLElement>("[data-auth-only]").forEach((field) => {
      const visible = this.formMode.isVisible(field.dataset.authOnly, mode);
      field.hidden = !visible;
      field.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
        input.required = visible;
        input.disabled = !visible;
      });
    });

    this.setText("#auth-form-title", titleByMode[mode]);
    this.setText("[data-auth-eyebrow]", eyebrowByMode[mode]);
    this.setText("[data-auth-copy]", copyByMode[mode]);
    this.setText("[data-auth-submit]", submitLabelByMode[mode]);

    const password = root.querySelector<HTMLInputElement>("#auth-password");
    if (password) {
      password.autocomplete = mode === "signup" ? "new-password" : "current-password";
    }
  }

  private async submit(event: Event): Promise<void> {
    event.preventDefault();
    const root = this.getRoot();
    if (!root) return;

    const mode = this.readMode(root.dataset.mode);
    const email = this.readValue("#auth-email");
    const password = this.readValue("#auth-password");
    const name = this.readValue("#auth-name");
    const confirmPassword = this.readValue("#auth-confirm-password");

    if (mode === "signup" && password !== confirmPassword) {
      this.options.notifier.show("Las contraseñas no coinciden.", "error");
      return;
    }

    this.setSubmitting(true);
    this.options.notifier.show(
      mode === "signup" ? "Creando tu cuenta…" : "Ingresando…",
      "loading",
    );

    try {
      if (mode === "signup") {
        await this.options.authApi.signUp({ name, email, password });
        this.options.notifier.show("Revisa tu correo para activar tu cuenta.", "success");
        this.navigate("/verify-email");
        return;
      }

      await this.options.authApi.signIn({ email, password });
      this.options.notifier.show("Sesión iniciada. Redirigiendo…", "success");
      this.navigate("/");
    } catch (error) {
      console.error(error);
      this.options.notifier.show(
        error instanceof Error ? error.message : "No fue posible autenticarte. 🙃",
        "error",
      );
    } finally {
      this.setSubmitting(false);
    }
  }

  private async submitGitHub(button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    this.options.notifier.show("Conectando con GitHub…", "loading");

    try {
      const { authorizationUrl } = await this.options.authApi.signInWithGitHub();
      this.navigate(authorizationUrl);
    } catch (error) {
      this.options.notifier.show(
        error instanceof Error ? error.message : "No fue posible autenticarte.",
        "error",
      );
      button.disabled = false;
    }
  }

  private readValue(selector: string): string {
    return this.getRoot()?.querySelector<HTMLInputElement>(selector)?.value.trim() ?? "";
  }

  private readMode(mode: string | undefined): AuthFormMode {
    return mode === "signup" ? "signup" : "login";
  }

  private setText(selector: string, value: string): void {
    const element = this.getRoot()?.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  }

  private setSubmitting(isSubmitting: boolean): void {
    const root = this.getRoot();
    if (!root) return;
    root.setAttribute("aria-busy", String(isSubmitting));
    const submit = root.querySelector<HTMLButtonElement>("[data-auth-submit]");
    if (submit) submit.disabled = isSubmitting;
  }
}
