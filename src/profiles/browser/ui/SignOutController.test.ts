import { afterEach, describe, expect, it, vi } from "vitest";
import { SignOutController } from "./SignOutController";

function setup() {
  const listeners: Array<() => Promise<void>> = [];
  const button = {
    dataset: {} as Record<string, string>,
    disabled: false,
    addEventListener: vi.fn((_event: string, listener: () => Promise<void>) => listeners.push(listener)),
  };
  const querySelector = vi.fn().mockReturnValue(button);
  vi.stubGlobal("document", { querySelector });
  const execute = vi.fn().mockResolvedValue(undefined);
  const show = vi.fn().mockReturnValue("sign-out");
  const controller = new SignOutController({ execute }, { show });
  return { button, listeners, querySelector, execute, show, controller };
}

afterEach(() => vi.unstubAllGlobals());

describe("SignOutController", () => {
  it("connects the click once even when mounted again after page-load", async () => {
    const { controller, button, listeners, execute } = setup();
    controller.mount();
    controller.mount();
    expect(button.addEventListener).toHaveBeenCalledTimes(1);
    await listeners[0]();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);
  });

  it("binds the replacement button after client navigation", async () => {
    const { controller, querySelector, execute } = setup();
    controller.mount();
    const addEventListener = vi.fn();
    querySelector.mockReturnValue({ dataset: {}, disabled: false, addEventListener });
    controller.mount();
    await addEventListener.mock.calls[0][1]();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate requests while sign-out is pending", async () => {
    const { controller, listeners, execute, button } = setup();
    let resolve!: () => void;
    execute.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    controller.mount();
    const pending = listeners[0]();
    expect(button.disabled).toBe(true);
    await listeners[0]();
    expect(execute).toHaveBeenCalledTimes(1);
    resolve();
    await pending;
    expect(button.disabled).toBe(false);
  });

  it("reports a failure and allows retry", async () => {
    const { controller, listeners, execute, show, button } = setup();
    execute.mockRejectedValueOnce(new Error("network"));
    controller.mount();
    await listeners[0]();
    expect(show).toHaveBeenCalledWith(expect.stringContaining("cerrar sesión"), "error");
    expect(button.disabled).toBe(false);
    await listeners[0]();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("does nothing on pages without the button", () => {
    const { controller, querySelector, execute } = setup();
    querySelector.mockReturnValue(null);
    expect(() => controller.mount()).not.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
