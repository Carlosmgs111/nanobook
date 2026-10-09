import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileApiError, type Profile } from "./HttpProfileApi";
import { ProfileFormController } from "./ProfileFormController";

class FakeElement {
  value = "";
  disabled = false;
  textContent = "";
  dataset: Record<string, string> = {};
  private readonly listeners = new Map<string, (event: Event) => void>();
  readonly elements = new Map<string, FakeElement>();
  querySelector<T extends FakeElement>(selector: string): T | null { return (this.elements.get(selector) as T | undefined) ?? null; }
  addEventListener(type: string, listener: (event: Event) => void): void { this.listeners.set(type, listener); }
}

function useForm() {
  const form = new FakeElement();
  const username = new FakeElement();
  const displayName = new FakeElement();
  const status = new FakeElement();
  const submit = new FakeElement();
  form.elements.set('[name="username"]', username);
  form.elements.set('[name="displayName"]', displayName);
  form.elements.set("[data-profile-status]", status);
  form.elements.set("[data-profile-submit]", submit);
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "[data-profile-form]" ? form : null });
  return { form, username, displayName, status };
}

afterEach(() => vi.unstubAllGlobals());

describe("ProfileFormController", () => {
  it("renders an existing profile as an update form with an immutable username", async () => {
    const view = useForm();
    const api = { getCurrent: vi.fn<() => Promise<Profile>>().mockResolvedValue({ username: "carlos", displayName: "Carlos" }), create: vi.fn(), update: vi.fn() };

    await new ProfileFormController(api).mount();

    expect(view.username.value).toBe("carlos");
    expect(view.username.disabled).toBe(true);
    expect(view.displayName.value).toBe("Carlos");
    expect(view.form.dataset.mode).toBe("update");
  });

  it("keeps the form in create mode when no profile exists", async () => {
    const view = useForm();
    const api = { getCurrent: vi.fn().mockRejectedValue(new ProfileApiError("ausente", 404)), create: vi.fn(), update: vi.fn() };

    await new ProfileFormController(api).mount();

    expect(view.username.disabled).toBe(false);
    expect(view.form.dataset.mode).toBe("create");
  });
});
