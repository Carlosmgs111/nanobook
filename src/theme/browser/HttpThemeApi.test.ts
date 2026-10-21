import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpThemeApi } from "./HttpThemeApi";

const details = { reference: { kind: "custom", id: "one" }, name: "One", baseThemeId: "classic", editable: true, tokens: {} };

describe("HttpThemeApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls the browser fetch with its global receiver", async () => {
    const fetcher = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis);
      return Promise.resolve(new Response("[]", { status: 200 }));
    });
    vi.stubGlobal("fetch", fetcher);

    await new HttpThemeApi().list();

    expect(fetcher).toHaveBeenCalledWith("/api/themes", { method: "GET" });
  });

  it("uses exact methods and encoded URLs for list and get", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([details]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(details), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const api = new HttpThemeApi();
    await api.list();
    await api.get("id/with space");
    expect(fetcher.mock.calls[0]).toEqual(["/api/themes", { method: "GET" }]);
    expect(fetcher.mock.calls[1]).toEqual(["/api/themes/id%2Fwith%20space", { method: "GET" }]);
  });

  it("sends structured JSON for create and update", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(details), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const api = new HttpThemeApi();
    const input = { name: "One", baseThemeId: "classic" as const, tokens: { light: { accent: "#123456" } } };
    await api.create(input);
    await api.update("one", { name: "Two", tokens: input.tokens });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify(input) });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ name: "Two", tokens: input.tokens }) });
  });

  it("extracts API error messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Color inválido" }), { status: 400 })));
    const api = new HttpThemeApi();
    await expect(api.list()).rejects.toThrow("Color inválido");
  });
});
