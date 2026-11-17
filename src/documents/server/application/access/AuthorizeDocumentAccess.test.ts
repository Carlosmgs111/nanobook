import { describe, expect, it } from "vitest";

import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import type { AccessGrantCodec, DocumentAccessRepository } from "../../domain/access/ports";
import { AuthorizeDocumentAccess } from "./AuthorizeDocumentAccess";

const now = new Date("2026-11-04T12:00:00.000Z");

function document(id: string, secured = true) {
  return Document.create(
    "guia",
    { id, title: id, description: "d", author: "a", ownerId: "owner-1", secured, createdAt: now, updatedAt: now },
    "# Secreto",
  ).getValue();
}

/** Versión de contraseña vigente por documento (null = protección retirada, ausente = sin registro). */
function repository(versions: Record<string, number | null>): DocumentAccessRepository {
  return {
    get: async (documentId) =>
      Result.ok(
        documentId in versions
          ? {
              documentId,
              passwordHash: versions[documentId] === null ? null : "hash",
              passwordVersion: versions[documentId] ?? 0,
            }
          : null,
      ),
    setPasswordHash: async () => {
      throw new Error("no usado");
    },
  };
}

/** Un token válido es exactamente `<documentId>:<versión>`. */
const codec: AccessGrantCodec = {
  issue: () => "",
  verify: (token, { documentId, passwordVersion }) => token === `${documentId}:${passwordVersion}`,
};

const grants = (tokens: Record<string, string>) => (documentId: string) => tokens[documentId];

describe("AuthorizeDocumentAccess", () => {
  const authorize = (versions: Record<string, number | null> = { "doc-1": 1 }) =>
    new AuthorizeDocumentAccess(repository(versions), codec, () => now);

  it("deja pasar documentos abiertos y cadenas vacías", async () => {
    const input = { canWrite: false, grantFor: grants({}) };

    expect((await authorize().execute({ ...input, documents: [document("doc-2", false)] })).kind).toBe("allow");
    expect((await authorize().execute({ ...input, documents: [null, undefined] })).kind).toBe("allow");
  });

  it("deja pasar a quien puede escribir sin grant y desafía al resto", async () => {
    const documents = [document("doc-1")];

    expect((await authorize().execute({ documents, canWrite: true, grantFor: grants({}) })).kind).toBe("allow");
    expect(await authorize().execute({ documents, canWrite: false, grantFor: grants({}) })).toEqual({
      kind: "challenge",
      method: "password",
    });
  });

  it("acepta un grant vigente y rechaza el de una versión anterior de la contraseña", async () => {
    const documents = [document("doc-1")];
    const grantFor = grants({ "doc-1": "doc-1:1" });

    expect((await authorize().execute({ documents, canWrite: false, grantFor })).kind).toBe("allow");
    expect((await authorize({ "doc-1": 2 }).execute({ documents, canWrite: false, grantFor })).kind).toBe("challenge");
  });

  it("falla cerrado si el documento protegido no tiene hash", async () => {
    for (const versions of [{ "doc-1": null }, {}]) {
      const decision = await authorize(versions).execute({
        documents: [document("doc-1")],
        canWrite: false,
        grantFor: grants({ "doc-1": "doc-1:0" }),
      });
      expect(decision.kind).toBe("challenge");
    }
  });

  it("exige grant para cada eslabón protegido de la cadena", async () => {
    const run = (tokens: Record<string, string>) =>
      authorize({ "doc-1": 1, "target-1": 1 }).execute({
        documents: [document("doc-1"), document("target-1")],
        canWrite: false,
        grantFor: grants(tokens),
      });

    expect((await run({ "doc-1": "doc-1:1" })).kind).toBe("challenge");
    expect((await run({ "doc-1": "doc-1:1", "target-1": "target-1:1" })).kind).toBe("allow");
  });
});
