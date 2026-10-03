import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserToastNotifier } from "./BrowserToastNotifier";

describe("BrowserToastNotifier", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("publishes a notification with its configured ID and default duration", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("document", { dispatchEvent });
    vi.stubGlobal("CustomEvent", class CustomEventMock {
      readonly type: string;
      readonly detail: unknown;
      constructor(type: string, init: { detail: unknown }) {
        this.type = type;
        this.detail = init.detail;
      }
    });

    const adapter = new BrowserToastNotifier("auth-flow");
    adapter.show("Ingresando…", "loading");

    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0][0]).toMatchObject({ type: "nanobook:toast" });
    expect(dispatchEvent.mock.calls[0][0].detail).toEqual({
      operation: "show",
      id: "auth-flow",
      kind: "loading",
      message: "Ingresando…",
      duration: 0,
    });
  });

  it("publishes dismissal for the adapter's configured ID", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("document", { dispatchEvent });
    vi.stubGlobal("CustomEvent", class CustomEventMock {
      readonly type: string;
      readonly detail: unknown;
      constructor(type: string, init: { detail: unknown }) {
        this.type = type;
        this.detail = init.detail;
      }
    });

    new BrowserToastNotifier("auth-flow").dismiss();

    expect(dispatchEvent.mock.calls[0][0]).toMatchObject({ type: "nanobook:toast" });
    expect(dispatchEvent.mock.calls[0][0].detail).toEqual({ operation: "dismiss", id: "auth-flow" });
  });
});
