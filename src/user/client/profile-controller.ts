import { HttpUserApi, HttpUserApiError } from "./api/HttpUserApi";
import type { UserProfile } from "../domain/types";
import type { Result } from "../../shared/domain/Result";

export type ProfilePhase =
  | "loading"
  | "ready"
  | "saving"
  | "saved"
  | "load-error"
  | "save-error";

export interface UserProfileClient {
  getUser(id: string): Promise<Result<HttpUserApiError, UserProfile>>;
  updateUser(
    id: string,
    input: { email?: string; displayName?: string }
  ): Promise<Result<HttpUserApiError, UserProfile>>;
}

export interface UserProfileUiState {
  phase: ProfilePhase;
  profile: UserProfile | null;
  draft: { email: string; displayName: string };
  message: string | null;
}

type StateListener = (state: UserProfileUiState) => void;

const EMPTY_DRAFT = { email: "", displayName: "" };

export class UserProfileController {
  private state: UserProfileUiState = {
    phase: "loading",
    profile: null,
    draft: { ...EMPTY_DRAFT },
    message: null,
  };
  private readonly listeners = new Set<StateListener>();

  constructor(
    private readonly api: UserProfileClient,
    private readonly userId: string,
    onStateChange: StateListener
  ) {
    this.listeners.add(onStateChange);
    onStateChange(this.getState());
  }

  getState(): UserProfileUiState {
    return {
      ...this.state,
      draft: { ...this.state.draft },
    };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.listeners.clear();
  }

  async load(): Promise<void> {
    if (this.state.phase !== "loading") {
      this.setState({ phase: "loading", message: null });
    }
    const result = await this.api.getUser(this.userId);
    if (!result.isSuccess) {
      this.setState({ phase: "load-error", message: toUserMessage(result.getError()) });
      return;
    }

    const profile = result.getValue();
    this.setState({
      phase: "ready",
      profile,
      draft: { email: profile.email, displayName: profile.displayName },
      message: null,
    });
  }

  async save(draft: { email: string; displayName: string }): Promise<void> {
    const normalizedDraft = {
      email: draft.email.trim(),
      displayName: draft.displayName.trim(),
    };
    if (!normalizedDraft.email || !normalizedDraft.displayName) {
      this.setState({
        draft: normalizedDraft,
        phase: "save-error",
        message: "Completa un email y un nombre visible.",
      });
      return;
    }

    this.setState({ phase: "saving", draft: normalizedDraft, message: null });
    const result = await this.api.updateUser(this.userId, normalizedDraft);
    if (!result.isSuccess) {
      this.setState({ phase: "save-error", message: toUserMessage(result.getError()) });
      return;
    }

    const profile = result.getValue();
    this.setState({
      phase: "saved",
      profile,
      draft: { email: profile.email, displayName: profile.displayName },
      message: "Perfil guardado.",
    });
  }

  async retry(): Promise<void> {
    await this.load();
  }

  private setState(next: Partial<UserProfileUiState>): void {
    this.state = { ...this.state, ...next };
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export function mountUserProfileForm(
  root: HTMLElement,
  userId: string,
  api: UserProfileClient = new HttpUserApi()
): () => void {
  const form = root.querySelector<HTMLFormElement>("form");
  const emailInput = root.querySelector<HTMLInputElement>('input[name="email"]');
  const displayNameInput = root.querySelector<HTMLInputElement>('input[name="displayName"]');
  const submitButton = root.querySelector<HTMLButtonElement>('button[type="submit"]');
  const status = root.querySelector<HTMLElement>("[data-profile-status]");
  const retryButton = root.querySelector<HTMLButtonElement>("[data-profile-retry]");

  if (!form || !emailInput || !displayNameInput || !submitButton || !status) {
    return () => undefined;
  }

  let controller: UserProfileController;
  const render = (state: UserProfileUiState) => {
    if (state.phase === "ready" || state.phase === "saved") {
      emailInput.value = state.draft.email;
      displayNameInput.value = state.draft.displayName;
    }
    const fieldsEditable =
      state.phase === "ready" ||
      state.phase === "saved" ||
      state.phase === "save-error";
    emailInput.disabled = !fieldsEditable;
    displayNameInput.disabled = !fieldsEditable;
    submitButton.disabled = state.phase === "loading" || state.phase === "saving";
    status.textContent = state.message ?? phaseMessage(state.phase);
    status.dataset.state = state.phase;
    if (retryButton) retryButton.hidden = state.phase !== "load-error";
  };

  controller = new UserProfileController(api, userId, render);
  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();
    void controller.save({
      email: emailInput.value,
      displayName: displayNameInput.value,
    });
  };
  const onRetry = () => void controller.retry();
  form.addEventListener("submit", onSubmit);
  retryButton?.addEventListener("click", onRetry);
  void controller.load();

  return () => {
    form.removeEventListener("submit", onSubmit);
    retryButton?.removeEventListener("click", onRetry);
    controller.destroy();
  };
}

function phaseMessage(phase: ProfilePhase): string {
  if (phase === "loading") return "Cargando perfil…";
  if (phase === "saving") return "Guardando…";
  return "";
}

function toUserMessage(error: HttpUserApiError): string {
  if (error.status === 400) return "Revisa los datos del perfil.";
  if (error.status === 404) return "No se encontró el perfil actual.";
  if (error.status === 409) return "Ese email ya está registrado.";
  if (error.status === 0) return "No se pudo conectar. Intenta de nuevo.";
  return "No se pudo actualizar el perfil. Intenta de nuevo.";
}
