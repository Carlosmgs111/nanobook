import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AuthApi,
  AuthenticatedUser,
  SignInRequest,
  SignUpRequest,
  SocialAuthorization,
} from "./HttpAuthApi";
import {
  AuthFormController,
} from "./AuthFormController";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("astro:transitions/client", () => ({ navigate }));

const authenticatedUser: AuthenticatedUser = {
  id: "user-123",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

class FakeAuthApi implements AuthApi {
  readonly signInRequests: SignInRequest[] = [];
  readonly signUpRequests: SignUpRequest[] = [];
  error: Error | undefined;
  githubAuthorizationUrl = "https://github.com/login/oauth/authorize?state=signed";

  async signIn(request: SignInRequest): Promise<AuthenticatedUser> {
    this.signInRequests.push(request);
    if (this.error) throw this.error;
    return authenticatedUser;
  }

  async signUp(request: SignUpRequest): Promise<AuthenticatedUser> {
    this.signUpRequests.push(request);
    if (this.error) throw this.error;
    return authenticatedUser;
  }

  async signInWithGitHub(): Promise<SocialAuthorization> {
    if (this.error) throw this.error;
    return { authorizationUrl: this.githubAuthorizationUrl };
  }
}

type Listener = (event: { preventDefault(): void }) => void | Promise<void>;

class FakeElement {
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Listener[]>();
  readonly one = new Map<string, FakeElement>();
  readonly many = new Map<string, FakeElement[]>();
  hidden = false;
  disabled = false;
  required = false;
  value = "";
  textContent = "";
  autocomplete = "";

  setQuery(selector: string, element: FakeElement): this {
    this.one.set(selector, element);
    return this;
  }

  setQueries(selector: string, elements: FakeElement[]): this {
    this.many.set(selector, elements);
    return this;
  }

  querySelector(selector: string): FakeElement | null {
    return this.one.get(selector) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.many.get(selector) ?? [];
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  async trigger(type: string): Promise<void> {
    for (const listener of this.listeners.get(type) ?? []) {
      await listener({ preventDefault() {} });
    }
  }
}

function createForm(mode: "login" | "signup" = "login") {
  const root = new FakeElement();
  root.dataset.mode = mode;

  const form = new FakeElement();
  const title = new FakeElement();
  const copy = new FakeElement();
  const notice = new FakeElement();
  const submit = new FakeElement();
  const githubButton = new FakeElement();
  const loginMode = new FakeElement();
  loginMode.dataset.authMode = "login";
  const signupMode = new FakeElement();
  signupMode.dataset.authMode = "signup";
  const name = new FakeElement();
  name.value = "Ada Lovelace";
  const email = new FakeElement();
  email.value = "ada@example.com";
  const password = new FakeElement();
  password.value = "password123";
  const confirmPassword = new FakeElement();
  confirmPassword.value = "password123";
  const nameField = new FakeElement();
  nameField.dataset.authOnly = "signup";
  nameField.setQueries("input", [name]);
  const confirmPasswordField = new FakeElement();
  confirmPasswordField.dataset.authOnly = "signup";
  confirmPasswordField.setQueries("input", [confirmPassword]);

  root
    .setQuery(".auth-form__fields", form)
    .setQuery("#auth-form-title", title)
    .setQuery("[data-auth-copy]", copy)
    .setQuery("[data-auth-notice]", notice)
    .setQuery("[data-auth-submit]", submit)
    .setQuery("[data-auth-provider=\"github\"]", githubButton)
    .setQuery("#auth-name", name)
    .setQuery("#auth-email", email)
    .setQuery("#auth-password", password)
    .setQuery("#auth-confirm-password", confirmPassword)
    .setQueries("[data-auth-mode]", [loginMode, signupMode])
    .setQueries("[data-auth-only]", [nameField, confirmPasswordField]);

  vi.stubGlobal("document", {
    querySelectorAll: () => [root],
  });

  return {
    root,
    form,
    notice,
    submit,
    githubButton,
    signupMode,
    nameField,
    confirmPasswordField,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthFormController", () => {
  it("submits login credentials through its injected authentication capability", async () => {
    const view = createForm();
    const authApi = new FakeAuthApi();
    const composer = new AuthFormController({
      authApi,
      notifier: { show() {} },
    });

    composer.mount();
    await view.form.trigger("submit");

    expect(authApi.signInRequests).toEqual([
      { email: "ada@example.com", password: "password123" },
    ]);
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("relies on Better Auth's cookie before navigating away from login", async () => {
    const view = createForm();
    const authApi = new FakeAuthApi();
    const composer = new AuthFormController({ authApi, notifier: { show() {} } });

    composer.mount();
    await view.form.trigger("submit");

    expect(authApi.signInRequests).toHaveLength(1);
    expect(navigate).toHaveBeenCalledWith("/");
  });

  it("submits registration data after the user changes to signup", async () => {
    const view = createForm();
    const authApi = new FakeAuthApi();
    const composer = new AuthFormController({
      authApi,
      notifier: { show() {} },
    });

    composer.mount();
    await view.signupMode.trigger("click");
    await view.form.trigger("submit");

    expect(authApi.signUpRequests).toEqual([
      {
        name: "Ada Lovelace",
        email: "ada@example.com",
        password: "password123",
      },
    ]);
    expect(navigate).toHaveBeenCalledWith("/verify-email");
  });

  it("exposes the registration fields only in signup mode", async () => {
    const view = createForm();
    const composer = new AuthFormController({
      authApi: new FakeAuthApi(),
      notifier: { show() {} },
    });

    composer.mount();
    expect(view.nameField.hidden).toBe(true);
    expect(view.confirmPasswordField.hidden).toBe(true);

    await view.signupMode.trigger("click");

    expect(view.nameField.hidden).toBe(false);
    expect(view.confirmPasswordField.hidden).toBe(false);
  });

  it("renders an authentication error and leaves the form enabled", async () => {
    const view = createForm();
    const authApi = new FakeAuthApi();
    authApi.error = new Error("Credenciales inválidas");
    const composer = new AuthFormController({
      authApi,
      notifier: { show: (message) => (view.notice.textContent = message) },
    });

    composer.mount();
    await view.form.trigger("submit");

    expect(view.notice.textContent).toBe("Credenciales inválidas");
    expect(view.submit.disabled).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("navigates to GitHub only after the social authorization URL is returned", async () => {
    const view = createForm();
    const composer = new AuthFormController({
      authApi: new FakeAuthApi(),
      notifier: { show() {} },
    });

    composer.mount();
    await view.githubButton.trigger("click");

    expect(navigate).toHaveBeenCalledWith(
      "https://github.com/login/oauth/authorize?state=signed",
    );
    expect(view.githubButton.disabled).toBe(true);
  });

  it("restores the GitHub control when social sign-in fails", async () => {
    const view = createForm();
    const authApi = new FakeAuthApi();
    authApi.error = new Error("GitHub no está disponible.");
    const composer = new AuthFormController({
      authApi,
      notifier: { show: (message) => (view.notice.textContent = message) },
    });

    composer.mount();
    await view.githubButton.trigger("click");

    expect(view.githubButton.disabled).toBe(false);
    expect(view.notice.textContent).toBe("GitHub no está disponible.");
  });
});
