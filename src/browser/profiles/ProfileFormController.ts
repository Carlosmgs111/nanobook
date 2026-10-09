import { ProfileApiError, type CreateProfileInput, type Profile } from "./HttpProfileApi";

export interface ProfileApi {
  getCurrent(): Promise<Profile>;
  create(input: CreateProfileInput): Promise<Profile>;
  update(input: Pick<Profile, "displayName">): Promise<Profile>;
}

export class ProfileFormController {
  private mode: "create" | "update" = "create";
  private form: HTMLFormElement | null = null;

  constructor(private readonly profileApi: ProfileApi) {}

  async mount(): Promise<void> {
    this.form = document.querySelector<HTMLFormElement>("[data-profile-form]");
    if (!this.form) return;
    if (this.form.dataset.profileFormReady !== "true") {
      this.form.dataset.profileFormReady = "true";
      this.form.addEventListener("submit", (event) => void this.submit(event));
    }
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      this.setProfile(await this.profileApi.getCurrent());
    } catch (error) {
      if (error instanceof ProfileApiError && error.status === 404) {
        this.setMode("create");
        return;
      }
      this.setStatus(error instanceof Error ? error.message : "No fue posible cargar el perfil.");
    }
  }

  private async submit(event: Event): Promise<void> {
    event.preventDefault();
    const username = this.usernameInput();
    const displayName = this.displayNameInput();
    if (!username || !displayName) return;

    this.setSubmitting(true);
    try {
      const profile = this.mode === "create"
        ? await this.profileApi.create({ username: username.value, displayName: displayName.value })
        : await this.profileApi.update({ displayName: displayName.value });
      this.setProfile(profile);
      this.setStatus("Perfil guardado.");
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : "No fue posible guardar el perfil.");
    } finally {
      this.setSubmitting(false);
    }
  }

  private setProfile(profile: Profile): void {
    const username = this.usernameInput();
    const displayName = this.displayNameInput();
    if (!username || !displayName) return;
    username.value = profile.username;
    username.disabled = true;
    displayName.value = profile.displayName;
    this.setMode("update");
  }

  private setMode(mode: "create" | "update"): void {
    this.mode = mode;
    if (this.form) this.form.dataset.mode = mode;
  }

  private setStatus(message: string): void {
    this.form?.querySelector<HTMLElement>("[data-profile-status]")?.replaceChildren(message);
  }

  private setSubmitting(submitting: boolean): void {
    const button = this.form?.querySelector<HTMLButtonElement>("[data-profile-submit]");
    if (button) button.disabled = submitting;
  }

  private usernameInput(): HTMLInputElement | null {
    return this.form?.querySelector<HTMLInputElement>('[name="username"]') ?? null;
  }

  private displayNameInput(): HTMLInputElement | null {
    return this.form?.querySelector<HTMLInputElement>('[name="displayName"]') ?? null;
  }
}
