import { BrowserToastNotifier } from "../../toast/BrowserToastNotifier";
import { HttpAuthApi } from "./HttpAuthApi";
import { AuthFormController } from "./AuthFormController";
import { HttpAuthSessionReader } from "./HttpAuthSessionReader";
import { SignOutController } from "./SignOutController";
import { navigate } from "astro:transitions/client";
import type {
  AuthenticatedSessionReader,
  AuthenticatedUser,
} from "../model/AuthSession";

export class GetAuthenticatedSession {
  constructor(private readonly sessionReader: AuthenticatedSessionReader) {}

  execute(): Promise<AuthenticatedUser | null> {
    return this.sessionReader.getCurrentUser();
  }
}

export class AuthModule {
  private constructor(
    private readonly authFormController: AuthFormController,
    public readonly getAuthenticatedSession: GetAuthenticatedSession,
    public readonly signOutController: SignOutController
  ) {}
  static create() {
    const authApi = new HttpAuthApi();
    const sessionReader = new HttpAuthSessionReader();
    const toast = new BrowserToastNotifier("auth-flow");
    const authFormController = new AuthFormController({
      authApi,
      notifier: toast,
    });
    const getAuthenticatedSession = new GetAuthenticatedSession(sessionReader);
    const signOutController = new SignOutController({
      authApi,
      confirm: () => globalThis.confirm("¿Seguro que deseas cerrar sesión?"),
      navigate,
    });
    return new AuthModule(
      authFormController,
      getAuthenticatedSession,
      signOutController
    );
  }
  mount() {
    this.authFormController.mount();
  }
}

export const authModule = AuthModule.create();
