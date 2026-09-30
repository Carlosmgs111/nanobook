import { HttpUserApi } from "../infraestructure/http/HttpUserApi";
import {
  UserProfileController,
  type UserProfileClient,
  type UserProfileUiState,
  type ProfilePhase,
} from "./user-profile-client";

export function mountUserProfileForm(
  root: HTMLElement,
  userId: string,
  api: UserProfileClient = new HttpUserApi()
): () => void {
  const form = root.querySelector<HTMLFormElement>("form");
  const emailInput = root.querySelector<HTMLInputElement>(
    'input[name="email"]'
  );
  const displayNameInput = root.querySelector<HTMLInputElement>(
    'input[name="displayName"]'
  );
  const submitButton = root.querySelector<HTMLButtonElement>(
    'button[type="submit"]'
  );
  const status = root.querySelector<HTMLElement>("[data-profile-status]");
  const retryButton = root.querySelector<HTMLButtonElement>(
    "[data-profile-retry]"
  );

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
    submitButton.disabled =
      state.phase === "loading" || state.phase === "saving";
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
