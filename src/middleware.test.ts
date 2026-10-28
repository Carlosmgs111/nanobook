import { describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({
  defineMiddleware: <T>(middleware: T) => middleware,
}));

import { onRequest } from "./middleware";

const APP_ORIGIN = "https://nanobook.test";

function context(pathname: string, request: Request) {
  return {
    url: new URL(pathname, APP_ORIGIN),
    request,
  } as Parameters<typeof onRequest>[0];
}

describe("application origin middleware", () => {
  it("rejects an untrusted browser mutation before the nanobook controller", async () => {
    const next = vi.fn();

    const response = await onRequest(
      context(
        "/api/nanobooks",
        new Request(`${APP_ORIGIN}/api/nanobooks`, {
          method: "POST",
          headers: { Origin: "https://evil.example" },
        }),
      ),
      next,
    );

    expect(response.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes same-origin mutations to the controller unchanged", async () => {
    const request = new Request(`${APP_ORIGIN}/api/nanobooks`, {
      method: "POST",
      headers: { Origin: APP_ORIGIN },
      body: "kept-intact",
    });
    const responseFromNext = new Response("ok");
    const next = vi.fn(async () => responseFromNext);

    const response = await onRequest(context("/api/nanobooks", request), next);

    expect(response).toBe(responseFromNext);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    await expect(request.text()).resolves.toBe("kept-intact");
  });

  it("bypasses the guard for Better Auth token requests without browser metadata", async () => {
    const responseFromNext = new Response("oauth");
    const next = vi.fn(async () => responseFromNext);

    const response = await onRequest(
      context(
        "/api/auth/oauth2/token",
        new Request(`${APP_ORIGIN}/api/auth/oauth2/token`, { method: "POST" }),
      ),
      next,
    );

    expect(response).toBe(responseFromNext);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects cross-site browser requests to MCP", async () => {
    const next = vi.fn();

    const response = await onRequest(
      context(
        "/mcp",
        new Request(`${APP_ORIGIN}/mcp`, {
          method: "POST",
          headers: { "Sec-Fetch-Site": "cross-site" },
        }),
      ),
      next,
    );

    expect(response.status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
