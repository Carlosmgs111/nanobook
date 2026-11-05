import { describe, expect, it, vi } from "vitest";

import { Document } from "../../domain/Document";
import { DEFAULT_ACCESS_GRANT_POLICY } from "../../domain/access/AccessGrantPolicy";
import { PasswordAccessPolicy } from "../../domain/access/DocumentAccessPolicy";
import {
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
} from "../../domain/errors";
import { AuthorizeDocumentAccess } from "./AuthorizeDocumentAccess";
import { FakeCodec, FakeHasher, FakeLimiter, InMemoryAccessRepository } from "./testDoubles";
import { UnlockDocument } from "./UnlockDocument";

const now = new Date("2026-11-04T12:00:00.000Z");

function document(id: string, secured: boolean, path = "guia") {
  return Document.create(
    path,
    {
      id,
      title: id,
      description: "Descripción",
      author: "Autora",
      ownerId: "owner-1",
      secured,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    "# Secreto",
  ).getValue();
}

const none = () => undefined;
const grants = (tokens: Record<string, string>) => (documentId: string) => tokens[documentId];

describe("AuthorizeDocumentAccess", () => {
  async function setup() {
    const accessRepository = new InMemoryAccessRepository();
    await accessRepository.setPasswordHash("doc-1", "hash:clave-correcta");
    const authorize = new AuthorizeDocumentAccess(accessRepository, new FakeCodec(), new PasswordAccessPolicy(), () => now);
    return { accessRepository, authorize };
  }

  it("allows documents that are not secured", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({ documents: [document("doc-2", false)], canWrite: false, grantFor: none });

    expect(decision).toEqual({ kind: "allow" });
  });

  it("allows writers without a cookie", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({ documents: [document("doc-1", true)], canWrite: true, grantFor: none });

    expect(decision.kind).toBe("allow");
  });

  it("challenges readers without a grant", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({ documents: [document("doc-1", true)], canWrite: false, grantFor: none });

    expect(decision).toEqual({ kind: "challenge", method: "password" });
  });

  it("allows readers holding a valid grant", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({
      documents: [document("doc-1", true)],
      canWrite: false,
      grantFor: grants({ "doc-1": "doc-1:1" }),
    });

    expect(decision.kind).toBe("allow");
  });

  it("rejects a grant from an older password version", async () => {
    const { authorize, accessRepository } = await setup();
    await accessRepository.setPasswordHash("doc-1", "hash:otra-clave-nueva");

    const decision = await authorize.execute({
      documents: [document("doc-1", true)],
      canWrite: false,
      grantFor: grants({ "doc-1": "doc-1:1" }),
    });

    expect(decision.kind).toBe("challenge");
  });

  it("fails closed when a secured document has no password hash", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({
      documents: [document("doc-9", true)],
      canWrite: false,
      grantFor: grants({ "doc-9": "doc-9:1" }),
    });

    expect(decision.kind).toBe("challenge");
  });

  it("requires a grant for every protected link of the proxy chain", async () => {
    const { authorize, accessRepository } = await setup();
    await accessRepository.setPasswordHash("target-1", "hash:clave-destino");
    const raw = document("doc-1", true);
    const resolved = document("target-1", true);

    const onlySource = await authorize.execute({
      documents: [raw, resolved],
      canWrite: false,
      grantFor: grants({ "doc-1": "doc-1:1" }),
    });
    const both = await authorize.execute({
      documents: [raw, resolved],
      canWrite: false,
      grantFor: grants({ "doc-1": "doc-1:1", "target-1": "target-1:1" }),
    });

    expect(onlySource.kind).toBe("challenge");
    expect(both.kind).toBe("allow");
  });

  it("ignores missing documents", async () => {
    const { authorize } = await setup();

    const decision = await authorize.execute({ documents: [null, undefined], canWrite: false, grantFor: none });

    expect(decision.kind).toBe("allow");
  });
});

describe("UnlockDocument", () => {
  async function setup(options: { raw?: Document | null; resolved?: Document | null } = {}) {
    const accessRepository = new InMemoryAccessRepository();
    await accessRepository.setPasswordHash("doc-1", "hash:clave-correcta");
    const limiter = new FakeLimiter();
    const raw = options.raw === undefined ? document("doc-1", true) : options.raw;
    const resolved = options.resolved === undefined ? raw : options.resolved;
    const getDocument = {
      executeRaw: vi.fn().mockResolvedValue(raw),
      execute: vi.fn().mockResolvedValue(resolved),
    };
    const unlock = new UnlockDocument(
      getDocument as never,
      accessRepository,
      new FakeHasher(),
      limiter,
      new FakeCodec(),
      DEFAULT_ACCESS_GRANT_POLICY,
      () => now,
    );
    return { accessRepository, limiter, unlock };
  }

  const input = { nanobookId: "book-a", documentPath: "guia", clientKey: "client-a" };

  it("issues a grant for the right password and resets the counter", async () => {
    const { unlock, limiter } = await setup();
    limiter.failures = 3;

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual({
      documentId: "doc-1",
      token: "doc-1:1",
      maxAgeSeconds: DEFAULT_ACCESS_GRANT_POLICY.ttlSeconds,
    });
    expect(limiter.failures).toBe(0);
  });

  it("fails with a generic error and records the failure for a wrong password", async () => {
    const { unlock, limiter } = await setup();

    const result = await unlock.execute({ ...input, password: "equivocada" });

    expect(result.getError()).toBeInstanceOf(DocumentUnlockFailedError);
    expect(limiter.failures).toBe(1);
  });

  it("refuses when the client is rate limited, without checking the password", async () => {
    const { unlock, limiter } = await setup();
    limiter.blockedFor = 600;

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    const error = result.getError();
    expect(error).toBeInstanceOf(DocumentUnlockRateLimitedError);
    expect((error as DocumentUnlockRateLimitedError).retryAfterSeconds).toBe(600);
  });

  it("answers not found for missing or unsecured documents", async () => {
    const missing = await (await setup({ raw: null, resolved: null })).unlock.execute({ ...input, password: "clave-correcta" });
    const open = await (await setup({ raw: document("doc-1", false) })).unlock.execute({ ...input, password: "clave-correcta" });

    expect(missing.getError()).toBeInstanceOf(DocumentNotFoundError);
    expect(open.getError()).toBeInstanceOf(DocumentNotFoundError);
  });

  it("cannot unlock a document whose protection was cleared", async () => {
    const { unlock, accessRepository } = await setup();
    await accessRepository.setPasswordHash("doc-1", null);

    const result = await unlock.execute({ ...input, password: "clave-correcta" });

    expect(result.getError()).toBeInstanceOf(DocumentUnlockFailedError);
  });

  it("unlocks whichever link of the proxy chain matches the password", async () => {
    const accessRepository = new InMemoryAccessRepository();
    await accessRepository.setPasswordHash("doc-1", "hash:clave-origen");
    await accessRepository.setPasswordHash("target-1", "hash:clave-destino");
    const getDocument = {
      executeRaw: vi.fn().mockResolvedValue(document("doc-1", true)),
      execute: vi.fn().mockResolvedValue(document("target-1", true)),
    };
    const unlock = new UnlockDocument(
      getDocument as never,
      accessRepository,
      new FakeHasher(),
      new FakeLimiter(),
      new FakeCodec(),
      DEFAULT_ACCESS_GRANT_POLICY,
      () => now,
    );

    const result = await unlock.execute({ ...input, password: "clave-destino" });

    expect(result.getValue().documentId).toBe("target-1");
  });
});
