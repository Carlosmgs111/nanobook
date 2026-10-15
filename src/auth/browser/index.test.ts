import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthModule } from "./index";

vi.mock("astro:transitions/client", () => ({ navigate: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup(confirmed = true, ok = true) {
  const replace = vi.fn();
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(ok ? { success: true } : { message: "Error" }), { status: ok ? 200 : 500 }));
  vi.stubGlobal("location", { replace });
  vi.stubGlobal("confirm", () => confirmed);
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(Date, "now").mockReturnValue(1792080000000);
  return { app: AuthModule.create(), replace, fetch };
}

describe("sign-out navigation", () => {
  it("loads a fresh public home after sign-out, bypassing cached redirects for /", async () => {
    const { app, replace, fetch } = setup();
    await app.signOut.execute();
    expect(fetch).toHaveBeenCalledWith("/api/auth/sign-out", expect.objectContaining({ method: "POST" }));
    expect(replace).toHaveBeenCalledWith("/?signed-out=1792080000000");
    expect(await app.getAuthenticatedSession.execute()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("stays on the page if confirmation is cancelled", async () => {
    const { app, replace, fetch } = setup(false);
    await app.signOut.execute();
    expect(fetch).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not navigate when closing the server session fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { app, replace } = setup(true, false);
    await expect(app.signOut.execute()).rejects.toThrow("Error");
    expect(replace).not.toHaveBeenCalled();
  });
});
