import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthStatusController } from "./AuthStatusController";
import type { GetAuthenticatedSession } from "../../auth/browser";
import type { AuthenticatedUser } from "../../auth/model/AuthSession";

class FakeElement {
  readonly elements = new Map<string, FakeElement>();
  hidden = false;
  textContent = "";

  querySelector(selector: string): FakeElement | null {
    return this.elements.get(selector) ?? null;
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
  const status = new FakeElement();
  const login = new FakeElement();
  root.elements.set("[data-auth-status]", status);
  root.elements.set("[data-auth-login]", login);
  return { root, status, login };
}

function useHeader(root: FakeElement): void {
  vi.stubGlobal("document", {
    querySelectorAll: () => [root],
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthStatusController", () => {
  it("replaces the login action with an authenticated status when Better Auth reports a user", async () => {
    const header = createHeader();
    useHeader(header.root);
    const getAuthenticatedSession = new FakeAuthSessionQuery({
      id: "user-123",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });

    await new AuthStatusController(getAuthenticatedSession).mount();

    expect(header.status.hidden).toBe(false);
    expect(header.status.textContent).toBe("Conectado: Ada Lovelace");
    expect(header.login.hidden).toBe(true);
  });

  it("keeps the login action visible when Better Auth reports no session", async () => {
    const header = createHeader();
    useHeader(header.root);

    await new AuthStatusController(new FakeAuthSessionQuery(null)).mount();

    expect(header.status.hidden).toBe(true);
    expect(header.login.hidden).toBe(false);
  });
});
