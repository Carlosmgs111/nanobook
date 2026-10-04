import type { AuthApi } from "./HttpAuthApi";
import type { AuthSessionStorage } from "./LocalStorageAuthSessionStorage";
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

export interface AuthFormControllerCapabilities {
  root: HTMLElement;
  authApi: AuthApi;
  sessionStorage: AuthSessionStorage;
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

export class AuthFormController {
  private readonly formMode = new AuthFormModeCapability();

  constructor(private readonly capabilities: AuthFormControllerCapabilities) {}

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

    const githubButton = root.querySelector<HTMLButtonElement>(
      '[data-auth-provider="github"]',
    );
    githubButton?.addEventListener("click", () => {
      void this.submitGitHub(githubButton);
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
        await this.capabilities.authApi.signUp({
          name,
          email,
          password,
        });
        this.capabilities.notifier.show(
          "Revisa tu correo para activar tu cuenta.",
          "success",
        );
        this.capabilities.navigate("/verify-email");
        return;
      } else {
        const session = await this.capabilities.authApi.signIn({
          email,
          password,
        });
        this.capabilities.sessionStorage.save(session);
      }
      this.capabilities.notifier.show(
        "Sesión iniciada. Redirigiendo…",
        "success"
      );
      this.capabilities.navigate("/");
    } catch (error) {
      console.error(error);
      this.capabilities.notifier.show(
        error instanceof Error ? error.message : "No fue posible autenticarte. 🙃",
        "error"
      );
    } finally {
      this.setSubmitting(false);
    }
  }

  private async submitGitHub(button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    this.capabilities.notifier.show("Conectando con GitHub…", "loading");

    try {
      const { authorizationUrl } = await this.capabilities.authApi.signInWithGitHub();
      this.capabilities.navigate(authorizationUrl);
    } catch (error) {
      this.capabilities.notifier.show(
        error instanceof Error ? error.message : "No fue posible autenticarte.",
        "error",
      );
      button.disabled = false;
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
