import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthStatusController } from "./AuthStatusController";
import type { GetAuthenticatedSession } from "../../auth";
import type { AuthenticatedUser } from "../../auth/model/AuthSession";

class FakeElement {
  readonly elements = new Map<string, FakeElement>();
  hidden = false;
  textContent = "";

  querySelector(selector: string): FakeElement | null {
    return this.elements.get(selector) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const element = this.elements.get(selector);
    return element ? [element] : [];
  }
}

class FakeAuthSessionQuery implements GetAuthenticatedSession {
  constructor(private readonly user: AuthenticatedUser | null) {}

  async execute(): Promise<AuthenticatedUser | null> {
    return this.user;
  }
}

function createHeader() {
  const root = new FakeElement();
  const profile = new FakeElement();
  const login = new FakeElement();
  const documentMutationAction = new FakeElement();
  root.elements.set("[data-auth-profile]", profile);
  root.elements.set("[data-auth-login]", login);
  root.elements.set("[data-auth-document-mutation]", documentMutationAction);
  return { root, profile, login, documentMutationAction };
}

function useHeader(
  root: FakeElement,
  documentMutationActions = [
    root.elements.get("[data-auth-document-mutation]") as FakeElement,
  ],
): void {
  vi.stubGlobal("document", {
    querySelectorAll: (selector: string) => {
      if (selector === "[data-auth-header]") return [root];
      if (selector === "[data-auth-document-mutation]") {
        return documentMutationActions;
      }
      return [];
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthStatusController", () => {
  it("replaces the login action with the authenticated user's profile action", async () => {
    const header = createHeader();
    useHeader(header.root);
    const getAuthenticatedSession = new FakeAuthSessionQuery({
      id: "user-123",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });

    await new AuthStatusController(getAuthenticatedSession).mount();

    expect(header.profile.hidden).toBe(false);
    expect(header.profile.textContent).toBe("Ada Lovelace");
    expect(header.login.hidden).toBe(true);
  });

  it("keeps the login action visible when Better Auth reports no session", async () => {
    const header = createHeader();
    useHeader(header.root);

    await new AuthStatusController(new FakeAuthSessionQuery(null)).mount();

    expect(header.profile.hidden).toBe(true);
    expect(header.login.hidden).toBe(false);
    expect(header.documentMutationAction.hidden).toBe(true);
  });

  it("shows document mutation actions only to an authenticated user", async () => {
    const header = createHeader();
    useHeader(header.root);

    await new AuthStatusController(
      new FakeAuthSessionQuery({
        id: "user-123",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    ).mount();

    expect(header.documentMutationAction.hidden).toBe(false);
  });

  it("updates document mutation actions rendered outside the header", async () => {
    const header = createHeader();
    const editor = new FakeElement();
    editor.hidden = true;
    useHeader(header.root, [header.documentMutationAction, editor]);

    await new AuthStatusController(
      new FakeAuthSessionQuery({
        id: "user-123",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    ).mount();

    expect(editor.hidden).toBe(false);
  });

  it("updates the header currently mounted after a client-side navigation", async () => {
    const previousHeader = createHeader();
    useHeader(previousHeader.root);
    const controller = new AuthStatusController(
      new FakeAuthSessionQuery({
        id: "user-123",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    );
    const currentHeader = createHeader();
    useHeader(currentHeader.root);

    await controller.mount();

    expect(currentHeader.profile.textContent).toBe("Ada Lovelace");
    expect(currentHeader.profile.hidden).toBe(false);
    expect(previousHeader.profile.textContent).toBe("");
  });
});
