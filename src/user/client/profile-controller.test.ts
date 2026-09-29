import { describe, expect, it, vi } from "vitest";
import { Result } from "../../shared/domain/Result";
import type { UserProfile } from "../domain/types";
import { HttpUserApiError } from "./api/HttpUserApi";
import { UserProfileController, mountUserProfileForm } from "./profile-controller";

function profile(
  id: string,
  email: string,
  displayName: string
): UserProfile {
  const date = new Date("2026-09-29T00:00:00.000Z");
  return { id, email, displayName, createdAt: date, updatedAt: date };
}

function fakeClient() {
  return {
    getUser: vi.fn(),
    updateUser: vi.fn(),
  };
}

class FakeElement {
  value = "";
  textContent = "";
  disabled = false;
  dataset: Record<string, string> = {};
  private listeners = new Map<string, Set<EventListener>>();

  constructor(private readonly children: Record<string, FakeElement> = {}) {}

  querySelector(selector: string) {
    return this.children[selector] ?? null;
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

describe("UserProfileController", () => {
  it("loads the current profile and saves the server response", async () => {
    const client = fakeClient();
    const oldProfile = profile("user-1", "old@example.com", "Old");
    const updatedProfile = profile("user-1", "new@example.com", "New");
    client.getUser.mockResolvedValue(Result.ok(oldProfile));
    client.updateUser.mockResolvedValue(Result.ok(updatedProfile));
    const states: Array<{ phase: string }> = [];
    const controller = new UserProfileController(client, "user-1", (state) => {
      states.push({ phase: state.phase });
    });

    await controller.load();
    await controller.save({ email: "new@example.com", displayName: "New" });

    expect(states.map((state) => state.phase)).toEqual([
      "loading",
      "ready",
      "saving",
      "saved",
    ]);
    expect(controller.getState().profile?.email).toBe("new@example.com");
    expect(client.updateUser).toHaveBeenCalledWith("user-1", {
      email: "new@example.com",
      displayName: "New",
    });
  });

  it("rejects blank drafts without calling the API", async () => {
    const client = fakeClient();
    client.getUser.mockResolvedValue(
      Result.ok(profile("user-1", "user@example.com", "User"))
    );
    const controller = new UserProfileController(client, "user-1", vi.fn());
    await controller.load();

    await controller.save({ email: " ", displayName: "" });

    expect(controller.getState().phase).toBe("save-error");
    expect(controller.getState().message).toBe("Completa un email y un nombre visible.");
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    [400, "Revisa los datos del perfil."],
    [404, "No se encontró el perfil actual."],
    [409, "Ese email ya está registrado."],
    [0, "No se pudo conectar. Intenta de nuevo."],
  ])("maps API status %s to actionable feedback", async (status, message) => {
    const client = fakeClient();
    client.getUser.mockResolvedValue(
      Result.fail(new HttpUserApiError("server error", status))
    );
    const controller = new UserProfileController(client, "user-1", vi.fn());

    await controller.load();

    expect(controller.getState().phase).toBe("load-error");
    expect(controller.getState().message).toBe(message);
  });

  it("retries a failed load exactly once", async () => {
    const client = fakeClient();
    client.getUser
      .mockResolvedValueOnce(Result.fail(new HttpUserApiError("offline", 0)))
      .mockResolvedValueOnce(Result.ok(profile("user-1", "user@example.com", "User")));
    const controller = new UserProfileController(client, "user-1", vi.fn());

    await controller.load();
    await controller.retry();

    expect(client.getUser).toHaveBeenCalledTimes(2);
    expect(controller.getState().phase).toBe("ready");
  });

  it("removes the submit listener during cleanup", async () => {
    const form = new FakeElement();
    const root = new FakeElement({
      form,
      'input[name="email"]': new FakeElement(),
      'input[name="displayName"]': new FakeElement(),
      'button[type="submit"]': new FakeElement(),
      '[data-profile-status]': new FakeElement(),
    });
    const client = fakeClient();
    client.getUser.mockResolvedValue(
      Result.ok(profile("user-1", "user@example.com", "User"))
    );

    const cleanup = mountUserProfileForm(
      root as unknown as HTMLElement,
      "user-1",
      client
    );

    expect(form.listenerCount("submit")).toBe(1);
    cleanup();
    expect(form.listenerCount("submit")).toBe(0);
  });

  it("enables profile fields after a successful load", async () => {
    const emailInput = new FakeElement();
    const displayNameInput = new FakeElement();
    emailInput.disabled = true;
    displayNameInput.disabled = true;
    const root = new FakeElement({
      form: new FakeElement(),
      'input[name="email"]': emailInput,
      'input[name="displayName"]': displayNameInput,
      'button[type="submit"]': new FakeElement(),
      '[data-profile-status]': new FakeElement(),
    });
    const client = fakeClient();
    client.getUser.mockResolvedValue(
      Result.ok(profile("user-1", "user@example.com", "User"))
    );

    const cleanup = mountUserProfileForm(root as unknown as HTMLElement, "user-1", client);
    await Promise.resolve();
    await Promise.resolve();

    expect(emailInput.disabled).toBe(false);
    expect(displayNameInput.disabled).toBe(false);
    cleanup();
  });
});
