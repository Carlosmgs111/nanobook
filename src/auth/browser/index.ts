import { BrowserToastNotifier } from "../../toast/BrowserToastNotifier";
import { HttpAuthApi } from "./HttpAuthApi";
import { AuthFormController } from "./AuthFormController";
import { HttpAuthSessionReader } from "./HttpAuthSessionReader";
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
    public readonly getAuthenticatedSession: GetAuthenticatedSession
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
    return new AuthModule(authFormController, getAuthenticatedSession);
  }
  mount() {
    this.authFormController.mount();
  }
}

export const authModule = AuthModule.create();
