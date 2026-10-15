import { describe, expect, it, vi } from "vitest";
import { HttpThemeApi } from "./HttpThemeApi";

const details = { reference: { kind: "custom", id: "one" }, name: "One", baseThemeId: "classic", editable: true, tokens: {} };

describe("HttpThemeApi", () => {
  it("uses exact methods and encoded URLs for list and get", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([details]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(details), { status: 200 }));
    const api = new HttpThemeApi(fetcher);
    await api.list();
    await api.get("id/with space");
    expect(fetcher.mock.calls[0]).toEqual(["/api/themes", { method: "GET" }]);
    expect(fetcher.mock.calls[1]).toEqual(["/api/themes/id%2Fwith%20space", { method: "GET" }]);
  });

  it("sends structured JSON for create and update", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(details), { status: 200 }));
    const api = new HttpThemeApi(fetcher);
    const input = { name: "One", baseThemeId: "classic" as const, tokens: { light: { accent: "#123456" } } };
    await api.create(input);
    await api.update("one", { name: "Two", tokens: input.tokens });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify(input) });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ name: "Two", tokens: input.tokens }) });
  });

  it("extracts API error messages", async () => {
    const api = new HttpThemeApi(vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Color inválido" }), { status: 400 })));
    await expect(api.list()).rejects.toThrow("Color inválido");
  });
});
