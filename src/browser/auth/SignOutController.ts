import type { AuthSignOutApi } from "./HttpAuthApi";

interface SignOutControllerCapabilities {
  authApi: AuthSignOutApi;
  confirm: () => boolean;
  navigate: (destination: string) => void;
}

export class SignOutController {
  constructor(private readonly capabilities: SignOutControllerCapabilities) {}

  async execute(): Promise<void> {
    if (!this.capabilities.confirm()) return;

    await this.capabilities.authApi.signOut();
    this.capabilities.navigate("/");
  }
}
