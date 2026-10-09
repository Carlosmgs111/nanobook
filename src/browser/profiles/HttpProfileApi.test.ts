import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpProfileApi } from "./HttpProfileApi";

describe("HttpProfileApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates the current profile through the private profile endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ username: "carlos", displayName: "Carlos" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new HttpProfileApi().create({ username: "carlos", displayName: "Carlos" })).resolves.toEqual({ username: "carlos", displayName: "Carlos" });
    expect(fetchMock).toHaveBeenCalledWith("/api/me/profile", expect.objectContaining({ method: "POST", credentials: "include" }));
  });

  it("surfaces an API error with its HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "ocupado" }), { status: 409 })));

    await expect(new HttpProfileApi().create({ username: "carlos", displayName: "Carlos" })).rejects.toMatchObject({ message: "ocupado", status: 409 });
  });
});
