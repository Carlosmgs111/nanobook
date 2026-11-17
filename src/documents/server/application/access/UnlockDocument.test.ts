import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import { DEFAULT_ACCESS_GRANT_POLICY } from "../../domain/access/AccessGrantPolicy";
import type { DocumentAccessRecord, UnlockAttemptLimiter } from "../../domain/access/ports";
import {
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
} from "../../domain/errors";
import { UnlockDocument } from "./UnlockDocument";

const now = new Date("2026-11-04T12:00:00.000Z");

function document(id: string, secured = true) {
  return Document.create(
    "guia",
    { id, title: id, description: "d", author: "a", ownerId: "owner-1", secured, createdAt: now, updatedAt: now },
    "# Secreto",
  ).getValue();
}

function setup(options: { hashes?: Record<string, string | null>; doc?: Document | null; blockedFor?: number } = {}) {
  const hashes = options.hashes ?? { "doc-1": "hash:clave-correcta" };
  const records = new Map<string, DocumentAccessRecord>(
    Object.entries(hashes).map(([documentId, passwordHash]) => [documentId, { documentId, passwordHash, passwordVersion: 1 }]),
  );
  const blockedFor = options.blockedFor ?? 0;
  const limiter = {
    check: vi.fn(async () => Result.ok({ blocked: blockedFor > 0, retryAfterSeconds: blockedFor })),
    recordFailure: vi.fn(async () => Result.ok()),
    reset: vi.fn(async () => Result.ok()),
  } satisfies UnlockAttemptLimiter;
  const doc = options.doc === undefined ? document("doc-1") : options.doc;
  const unlock = new UnlockDocument(
    { executeChain: vi.fn().mockResolvedValue(doc ? { raw: doc, resolved: doc } : null) } as never,
    { get: async (id) => Result.ok(records.get(id) ?? null), setPasswordHash: vi.fn() },
    { hash: async (password) => `hash:${password}`, verify: async (password, stored) => stored === `hash:${password}` },
    limiter,
    { issue: ({ documentId, passwordVersion }) => `${documentId}:${passwordVersion}`, verify: () => true },
    DEFAULT_ACCESS_GRANT_POLICY,
    () => now,
  );
  return { unlock, limiter };
}

const input = { nanobookId: "book-a", documentPath: "guia", clientKey: "client-a" };

describe("UnlockDocument", () => {
  it("emite un grant con la contraseña correcta y reinicia los intentos", async () => {
    const { unlock, limiter } = setup();

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    expect(result.getValue()).toEqual({
      documentId: "doc-1",
      token: "doc-1:1",
      maxAgeSeconds: DEFAULT_ACCESS_GRANT_POLICY.ttlSeconds,
    });
    expect(limiter.reset).toHaveBeenCalled();
    expect(limiter.recordFailure).not.toHaveBeenCalled();
  });

  it("falla con error genérico y registra el intento con contraseña incorrecta", async () => {
    const { unlock, limiter } = setup();

    const result = await unlock.execute({ ...input, password: "equivocada" });

    expect(result.getError()).toBeInstanceOf(DocumentUnlockFailedError);
    expect(limiter.recordFailure).toHaveBeenCalledTimes(1);
  });

  it("rechaza por límite de intentos sin comprobar la contraseña", async () => {
    const { unlock, limiter } = setup({ blockedFor: 600 });

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    const error = result.getError();
    expect(error).toBeInstanceOf(DocumentUnlockRateLimitedError);
    expect((error as DocumentUnlockRateLimitedError).retryAfterSeconds).toBe(600);
    expect(limiter.reset).not.toHaveBeenCalled();
  });

  it("responde no encontrado para documentos inexistentes o sin protección", async () => {
    const missing = await setup({ doc: null }).unlock.execute({ ...input, password: "x" });
    const open = await setup({ doc: document("doc-1", false) }).unlock.execute({ ...input, password: "x" });

    expect(missing.getError()).toBeInstanceOf(DocumentNotFoundError);
    expect(open.getError()).toBeInstanceOf(DocumentNotFoundError);
  });

  it("no desbloquea un documento cuya protección fue retirada", async () => {
    const { unlock } = setup({ hashes: { "doc-1": null } });

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    expect(result.getError()).toBeInstanceOf(DocumentUnlockFailedError);
  });
});
