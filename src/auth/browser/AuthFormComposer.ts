import type { AuthApi } from "./HttpAuthApi";
import type { ToastNotifier } from "../../toast/BrowserToastNotifier";

type AuthFormMode = "login" | "signup";

class AuthFormModeCapability {
  isVisible(
    fieldMode: string | undefined,
    selectedMode: AuthFormMode
  ): boolean {
    return fieldMode === selectedMode;
  }
}

export interface AuthFormComposerCapabilities {
  root: HTMLElement;
  authApi: AuthApi;
  notifier: ToastNotifier;
  navigate(path: string): void;
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

export class AuthFormComposer {
  private readonly formMode = new AuthFormModeCapability();

  constructor(private readonly capabilities: AuthFormComposerCapabilities) {}

  mount(): void {
    const { root } = this.capabilities;
    if (root.dataset.authFormReady === "true") return;
    root.dataset.authFormReady = "true";

    root
      .querySelectorAll<HTMLButtonElement>("[data-auth-mode]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          this.setMode(this.readMode(button.dataset.authMode));
        });
      });

    const form = root.querySelector<HTMLFormElement>(".auth-form__fields");
    form?.addEventListener("submit", async (event) => {
      await this.submit(event);
    });

    this.setMode(this.readMode(root.dataset.mode));
  }

  private setMode(mode: AuthFormMode): void {
    const { root } = this.capabilities;
    root.dataset.mode = mode;

    root.querySelectorAll<HTMLElement>("[data-auth-mode]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.authMode === mode)
      );
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
    this.setText("[data-auth-copy]", copyByMode[mode]);
    this.setText("[data-auth-submit]", submitLabelByMode[mode]);

    const password = root.querySelector<HTMLInputElement>("#auth-password");
    if (password)
      password.autocomplete =
        mode === "signup" ? "new-password" : "current-password";
  }

  private async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const mode = this.readMode(this.capabilities.root.dataset.mode);
    const email = this.readValue("#auth-email");
    const password = this.readValue("#auth-password");
    const name = this.readValue("#auth-name");
    const confirmPassword = this.readValue("#auth-confirm-password");

    if (mode === "signup" && password !== confirmPassword) {
      this.capabilities.notifier.show("Las contraseñas no coinciden.", "error");
      return;
    }

    this.setSubmitting(true);
    this.capabilities.notifier.show(
      mode === "signup" ? "Creando tu cuenta…" : "Ingresando…",
      "loading"
    );

    try {
      if (mode === "signup") {
        const result = await this.capabilities.authApi.signUp({
          name,
          email,
          password,
        });
      } else {
        const result = await this.capabilities.authApi.signIn({
          email,
          password,
        });
      }
      this.capabilities.notifier.show(
        mode === "signup"
          ? "Tu cuenta está lista. Redirigiendo—"
          : "Sesión iniciada. Redirigiendo…",
        "success"
      );
      window.setTimeout(() => this.capabilities.navigate("/"), 900);
    } catch (error) {
      this.capabilities.notifier.show(
        error instanceof Error ? error.message : "No fue posible autenticarte.",
        "error"
      );
    } finally {
      this.setSubmitting(false);
    }
  }

  private readValue(selector: string): string {
    return (
      this.capabilities.root
        .querySelector<HTMLInputElement>(selector)
        ?.value.trim() ?? ""
    );
  }

  private readMode(mode: string | undefined): AuthFormMode {
    return mode === "signup" ? "signup" : "login";
  }

  private setText(selector: string, value: string): void {
    const element = this.capabilities.root.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  }

  private setSubmitting(isSubmitting: boolean): void {
    this.capabilities.root.setAttribute("aria-busy", String(isSubmitting));
    const submit =
      this.capabilities.root.querySelector<HTMLButtonElement>(
        "[data-auth-submit]"
      );
    if (submit) submit.disabled = isSubmitting;
  }
}
