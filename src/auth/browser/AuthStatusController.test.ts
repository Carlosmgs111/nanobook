import { describe, expect, it } from "vitest";

import { AuthStatusController } from "./AuthStatusController";
import type {
  AuthenticatedSession,
  AuthSessionStorage,
} from "./AuthSessionStorage";

class FakeElement {
  readonly elements = new Map<string, FakeElement>();
  hidden = false;
  textContent = "";

  querySelector(selector: string): FakeElement | null {
    return this.elements.get(selector) ?? null;
  }
}

class FakeAuthSessionStorage implements AuthSessionStorage {
  constructor(private readonly session: AuthenticatedSession | null) {}

  save(): void {}

  load(): AuthenticatedSession | null {
    return this.session;
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

describe("AuthStatusController", () => {
  it("replaces the login action with an authenticated status when a stored session exists", () => {
    const header = createHeader();
    const sessionStorage = new FakeAuthSessionStorage({
      token: "session-token",
      user: { id: "user-123", name: "Ada Lovelace", email: "ada@example.com" },
    });

    new AuthStatusController({
      root: header.root as unknown as HTMLElement,
      sessionStorage,
    }).mount();

    expect(header.status.hidden).toBe(false);
    expect(header.status.textContent).toBe("Conectado: Ada Lovelace");
    expect(header.login.hidden).toBe(true);
  });

  it("keeps the login action visible when no stored session exists", () => {
    const header = createHeader();

    new AuthStatusController({
      root: header.root as unknown as HTMLElement,
      sessionStorage: new FakeAuthSessionStorage(null),
    }).mount();

    expect(header.status.hidden).toBe(true);
    expect(header.login.hidden).toBe(false);
  });
});
