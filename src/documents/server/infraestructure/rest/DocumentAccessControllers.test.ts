import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import type { ClearDocumentPassword } from "../../application/access/ClearDocumentPassword";
import type { SetDocumentPassword } from "../../application/access/SetDocumentPassword";
import type { UnlockDocument } from "../../application/access/UnlockDocument";
import {
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
  WriteAccessDeniedError,
} from "../../domain/errors";
import { DocumentAccessAdminController } from "./DocumentAccessAdminController";
import { UnlockDocumentController } from "./UnlockDocumentController";

function request(method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://nanobook.test/api/nanobooks/book-a/document-access", {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

describe("DocumentAccessAdminController", () => {
  const controller = (set = vi.fn(), clear = vi.fn()) =>
    new DocumentAccessAdminController({ execute: set } as unknown as SetDocumentPassword, {
      execute: clear,
    } as unknown as ClearDocumentPassword);
  const put = (c: DocumentAccessAdminController, locals: object) =>
    c.put({
      params: { nanobookId: "book-a" },
      request: request("PUT", { path: "guia", password: "una-clave-segura" }),
      locals,
    } as never);

  it("exige usuario autenticado y no ejecuta nada sin él", async () => {
    const set = vi.fn();

    expect((await put(controller(set), {})).status).toBe(401);
    expect(set).not.toHaveBeenCalled();
  });

  it("pasa el actor autenticado al caso de uso", async () => {
    const set = vi.fn().mockResolvedValue(Result.ok());
    const clear = vi.fn().mockResolvedValue(Result.ok());

    expect((await put(controller(set, clear), { currentUserId: "owner-1" })).status).toBe(200);
    await controller(set, clear).delete({
      params: { nanobookId: "book-a" },
      request: request("DELETE", { path: "guia" }),
      locals: { currentUserId: "owner-1" },
    } as never);

    expect(set).toHaveBeenCalledWith("book-a", "guia", "una-clave-segura", "owner-1");
    expect(clear).toHaveBeenCalledWith("book-a", "guia", "owner-1");
  });

  it("un actor sin permiso de escritura recibe un error y no una respuesta de éxito", async () => {
    const set = vi.fn().mockResolvedValue(Result.fail(new WriteAccessDeniedError("book-a")));

    const response = await put(controller(set), { currentUserId: "intruso" });

    expect(response.status).not.toBe(200);
  });
});

describe("UnlockDocumentController", () => {
  const call = (execute: ReturnType<typeof vi.fn>, body: unknown, headers: Record<string, string> = {}) =>
    new UnlockDocumentController({ execute } as unknown as UnlockDocument).handle({
      params: { nanobookId: "book-a" },
      request: request("POST", body, headers),
      clientAddress: "203.0.113.7",
    } as never);

  it("entrega el grant en una cookie HttpOnly sin exponer el token en el cuerpo", async () => {
    const execute = vi.fn().mockResolvedValue(Result.ok({ documentId: "doc-1", token: "t.s", maxAgeSeconds: 43200 }));

    const response = await call(execute, { path: "guia", password: "clave-correcta" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const cookie = response.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("=t.s");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Max-Age=43200");
  });

  it("deriva una clave de cliente con hash a partir de la IP", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockFailedError()));

    await call(execute, { path: "guia", password: "x" }, { "x-vercel-forwarded-for": "198.51.100.9" });

    const key = execute.mock.calls[0][0].clientKey as string;
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain("198.51.100.9");
  });

  it("responde 403 genérico sin cookie ante contraseña incorrecta", async () => {
    const response = await call(vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockFailedError())), {
      path: "guia",
      password: "mal",
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("Set-Cookie")).toBeNull();
  });

  it("responde 429 con Retry-After al superar el límite", async () => {
    const response = await call(
      vi.fn().mockResolvedValue(Result.fail(new DocumentUnlockRateLimitedError(420))),
      { path: "guia", password: "x" },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("420");
  });

  it("responde 404 para documentos desconocidos y 400 sin llamar al caso de uso con cuerpos inválidos", async () => {
    const execute = vi.fn().mockResolvedValue(Result.fail(new DocumentNotFoundError("guia")));

    expect((await call(execute, { path: "guia", password: "x" })).status).toBe(404);

    execute.mockClear();
    expect((await call(execute, { path: "guia" })).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });
});
