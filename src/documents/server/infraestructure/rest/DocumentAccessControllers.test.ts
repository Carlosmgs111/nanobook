import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import type { ClearDocumentPassword } from "../../application/access/ClearDocumentPassword";
import type { SetDocumentPassword } from "../../application/access/SetDocumentPassword";
import type { UnlockDocument } from "../../application/access/UnlockDocument";
import {
  DocumentAccessDeniedError,
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
  InvalidDocumentPasswordError,
} from "../../domain/errors";
import { DocumentAccessAdminController } from "./DocumentAccessAdminController";
import { UnlockDocumentController } from "./UnlockDocumentController";

function request(method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://nanobook.test/api/nanobooks/book-a/document-access", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("DocumentAccessAdminController", () => {
  function setup(set = vi.fn(), clear = vi.fn()) {
    return {
      set,
      clear,
      controller: new DocumentAccessAdminController(
        { execute: set } as unknown as SetDocumentPassword,
        { execute: clear } as unknown as ClearDocumentPassword,
      ),
    };
  }

  it("sets a password for the signed-in actor", async () => {
    const { controller, set } = setup(vi.fn().mockResolvedValue(Result.ok()));

    const response = await controller.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { path: "guia", password: "una-clave-segura" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ secured: true });
    expect(set).toHaveBeenCalledWith("book-a", "guia", "una-clave-segura", "owner-1");
  });

  it("requires an authenticated actor and a path", async () => {
    const { controller } = setup();

    const anonymous = await controller.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { path: "guia", password: "una-clave-segura" }),
      locals: {},
    } as never);
    const missingPath = await controller.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { password: "una-clave-segura" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(anonymous.status).toBe(401);
    expect(missingPath.status).toBe(400);
  });

  it.each([
    [new InvalidDocumentPasswordError("corta"), 400],
    [new DocumentNotFoundError("guia"), 404],
    [new DocumentAccessDeniedError("doc-1"), 403],
  ])("maps %s to its HTTP status", async (error, status) => {
    const { controller } = setup(vi.fn().mockResolvedValue(Result.fail(error)));

    const response = await controller.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { path: "guia", password: "una-clave-segura" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(status);
  });

  it("clears the protection", async () => {
    const { controller, clear } = setup(vi.fn(), vi.fn().mockResolvedValue(Result.ok()));

    const response = await controller.delete({
      params: { nanobookId: "book-a" },
      request: request("DELETE", { path: "guia" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ secured: false });
    expect(clear).toHaveBeenCalledWith("book-a", "guia", "owner-1");
  });
});

describe("UnlockDocumentController", () => {
  const context = (execute: ReturnType<typeof vi.fn>, headers: Record<string, string> = {}) => ({
    call: (body: unknown) =>
      new UnlockDocumentController({ execute } as unknown as UnlockDocument).handle({
        params: { nanobookId: "book-a" },
        request: request("POST", body, headers),
        clientAddress: "203.0.113.7",
      } as never),
  });

  it("sets an HttpOnly grant cookie on success", async () => {
    const execute = vi.fn().mockResolvedValue(Result.ok({ cookieName: "nbk-grant-abc", token: "t.s", maxAgeSeconds: 43200 }));

    const response = await context(execute).call({ path: "guia", password: "clave-correcta" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("nbk-grant-abc=t.s");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/n");
    expect(cookie).toContain("Max-Age=43200");
  });

  it("derives a hashed client key from the platform IP header", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockFailedError()));

    await context(execute, { "x-vercel-forwarded-for": "198.51.100.9" }).call({ path: "guia", password: "x" });

    const key = execute.mock.calls[0][0].clientKey as string;
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain("198.51.100.9");
  });

  it("answers 403 with a generic message for a wrong password", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockFailedError()));

    const response = await context(execute).call({ path: "guia", password: "mal" });

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("Contraseña incorrecta");
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("answers 429 with Retry-After when rate limited", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockRateLimitedError(420)));

    const response = await context(execute).call({ path: "guia", password: "x" });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("420");
  });

  it("answers a generic 404 for unknown or unprotected documents", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentNotFoundError("guia")));

    const response = await context(execute).call({ path: "guia", password: "x" });

    expect(response.status).toBe(404);
  });

  it("rejects malformed bodies without calling the use case", async () => {
    const execute = vi.fn();

    const response = await context(execute).call({ path: "guia" });

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
