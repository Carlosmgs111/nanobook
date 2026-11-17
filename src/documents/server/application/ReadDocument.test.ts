import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { AccessGrantCodec, DocumentAccessRepository } from "../domain/access/ports";
import { DocumentRepositoryError } from "../domain/errors";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { AuthorizeDocumentAccess } from "./access/AuthorizeDocumentAccess";
import { ReadDocument, type DocumentViewer } from "./ReadDocument";
import { allowWrites, denyWrites } from "./test/factories";

function document(id: string, secured: boolean, content = "# Secreto") {
  const date = new Date("2026-01-01");
  return Document.create(
    "guia",
    { id, title: `Título ${id}`, description: "Descripción", secured, createdAt: date, updatedAt: date },
    content,
  ).getValue();
}

function setup(chain: { raw: Document; resolved: Document } | null, writeAccess: WriteAccess = denyWrites) {
  // Todo documento protegido tiene contraseña; el grant válido es `<id>:1`.
  const accessRepository = {
    get: async (documentId: string) => Result.ok({ documentId, passwordHash: "hash", passwordVersion: 1 }),
  } as unknown as DocumentAccessRepository;
  const codec = { verify: (token: string, input: { documentId: string }) => token === `${input.documentId}:1` };
  const authorize = new AuthorizeDocumentAccess(accessRepository, codec as unknown as AccessGrantCodec);
  const getDocument = { executeChain: vi.fn().mockResolvedValue(chain) };
  return new ReadDocument(getDocument, authorize, writeAccess);
}

function viewer(userId?: string, grants: Record<string, string> = {}) {
  const resolveUser = vi.fn().mockResolvedValue(userId);
  const value: DocumentViewer = { userId: resolveUser, grantFor: (id) => grants[id] };
  return { value, resolveUser };
}

const input = { nanobookId: "book", path: "guia" };

describe("ReadDocument", () => {
  it("reports a missing document", async () => {
    expect(await setup(null).execute({ ...input, viewer: viewer().value })).toEqual({ kind: "not-found" });
  });

  it("allows an open document without resolving the viewer", async () => {
    const open = document("open", false);
    const v = viewer("user");

    const result = await setup({ raw: open, resolved: open }).execute({ ...input, viewer: v.value });

    expect(result).toEqual({ kind: "allowed", document: open, via: "open" });
    expect(v.resolveUser).not.toHaveBeenCalled();
  });

  it("allows writers and readers with a valid grant on a protected document", async () => {
    const secured = document("doc-1", true);
    const chain = { raw: secured, resolved: secured };

    expect(await setup(chain, allowWrites).execute({ ...input, viewer: viewer("user").value })).toMatchObject({
      kind: "allowed",
      via: "writer",
    });
    expect(
      await setup(chain).execute({ ...input, viewer: viewer("user", { "doc-1": "doc-1:1" }).value }),
    ).toMatchObject({ kind: "allowed", via: "grant" });
  });

  it("challenges everyone else with a redacted document, also when the write port fails", async () => {
    const secured = document("doc-1", true, "# No debe salir");
    const chain = { raw: secured, resolved: secured };
    const broken: WriteAccess = { require: async () => Result.fail(new DocumentRepositoryError("db caída")) };

    for (const [writeAccess, userId] of [[denyWrites, undefined], [denyWrites, "user"], [broken, "user"]] as const) {
      const result = await setup(chain, writeAccess).execute({ ...input, viewer: viewer(userId).value });
      expect(result.kind).toBe("challenge");
      if (result.kind !== "challenge") throw new Error("unreachable");
      expect(result.document.getContent()).toBe("");
      expect(result.document.getDescription()).toBe("");
    }
  });

  it("challenges when only one link of a proxy chain is protected, never returning the target", async () => {
    const open = document("open", false, "# Público");
    const secret = document("secret", true, "# Destino protegido");

    const protectedTarget = await setup({ raw: open, resolved: secret }).execute({ ...input, viewer: viewer("user").value });
    const protectedSource = await setup({ raw: secret, resolved: open }).execute({ ...input, viewer: viewer("user").value });

    for (const result of [protectedTarget, protectedSource]) {
      expect(result.kind).toBe("challenge");
      if (result.kind !== "challenge") throw new Error("unreachable");
      expect(result.document.getContent()).toBe("");
    }
  });
});
