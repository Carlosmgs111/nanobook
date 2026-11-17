import { describe, expect, it, vi } from "vitest";
import { AccessCheckFailedError, createAuthorizer, type Authorizer, type Policy } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { AccessGrantCodec, DocumentAccessRepository } from "../domain/access/ports";
import { DocumentPasswordPolicy } from "./access/DocumentPasswordPolicy";
import { ReadDocument, type DocumentViewer } from "./ReadDocument";

function document(id: string, secured: boolean, content = "# Secreto") {
  const date = new Date("2026-01-01");
  return Document.create(
    "guia",
    { id, title: `Título ${id}`, description: "Descripción", secured, createdAt: date, updatedAt: date },
    content,
  ).getValue();
}

/** Hace de política del módulo dueño del nanobook: permite `read` y deja `write` solo al usuario `owner`. */
const nanobookPolicy: Policy = {
  appliesTo: ["document"],
  evaluate: async ({ action, subject }) => {
    if (action === "read") return { effect: "allow" };
    return (await subject.userId()) === "owner" ? { effect: "allow" } : { effect: "abstain" };
  },
};

function setup(
  chain: { raw: Document; resolved: Document } | null,
  extraPolicies: Policy[] = [nanobookPolicy],
  authorizerOverride?: Authorizer,
) {
  // Todo documento protegido tiene contraseña; el grant válido es `<id>:1`.
  const accessRepository = {
    get: async (documentId: string) => Result.ok({ documentId, passwordHash: "hash", passwordVersion: 1 }),
  } as unknown as DocumentAccessRepository;
  const codec = { verify: (token: string, input: { documentId: string }) => token === `${input.documentId}:1` };
  const authorizer =
    authorizerOverride ??
    createAuthorizer([new DocumentPasswordPolicy(accessRepository, codec as unknown as AccessGrantCodec), ...extraPolicies]);
  const authorize = vi.spyOn(authorizer, "authorize");
  const getDocument = { executeChain: vi.fn().mockResolvedValue(chain) };
  return { read: new ReadDocument(getDocument, authorizer), authorize };
}

function viewer(userId?: string, grants: Record<string, string> = {}) {
  const resolveUser = vi.fn().mockResolvedValue(userId);
  const value: DocumentViewer = { userId: resolveUser, grantFor: (id) => grants[id] };
  return { value, resolveUser };
}

const input = { nanobookId: "book", path: "guia" };

describe("ReadDocument", () => {
  it("reports a missing document", async () => {
    const { read } = setup(null);
    expect(await read.execute({ ...input, viewer: viewer().value })).toEqual({ kind: "not-found" });
  });

  it("allows an open document without consulting the authorizer or resolving the viewer", async () => {
    const open = document("open", false);
    const v = viewer("user");
    const { read, authorize } = setup({ raw: open, resolved: open });

    const result = await read.execute({ ...input, viewer: v.value });

    expect(result).toEqual({ kind: "allowed", document: open, via: "open" });
    expect(authorize).not.toHaveBeenCalled();
    expect(v.resolveUser).not.toHaveBeenCalled();
  });

  it("allows writers and readers with a valid grant on a protected document", async () => {
    const secured = document("doc-1", true);
    const chain = { raw: secured, resolved: secured };

    expect(await setup(chain).read.execute({ ...input, viewer: viewer("owner").value })).toMatchObject({
      kind: "allowed",
      via: "protected",
    });
    expect(
      await setup(chain).read.execute({ ...input, viewer: viewer("user", { "doc-1": "doc-1:1" }).value }),
    ).toMatchObject({ kind: "allowed", via: "protected" });
  });

  it("asks the authorizer to read a document resource carrying the protected chain", async () => {
    const secured = document("doc-1", true);
    const { read, authorize } = setup({ raw: secured, resolved: secured });

    await read.execute({ ...input, viewer: viewer("owner").value });

    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "read",
        resource: { type: "document", id: "doc-1", nanobookId: "book", attributes: { securedIds: ["doc-1"] } },
      }),
    );
  });

  it("challenges a reader without a grant with a redacted document", async () => {
    const secured = document("doc-1", true, "# No debe salir");
    const chain = { raw: secured, resolved: secured };

    for (const userId of [undefined, "user"]) {
      const { read } = setup(chain);
      const result = await read.execute({ ...input, viewer: viewer(userId).value });
      expect(result.kind).toBe("challenge");
      if (result.kind !== "challenge") throw new Error("unreachable");
      expect(result.document.getContent()).toBe("");
      expect(result.document.getDescription()).toBe("");
    }
  });

  it("challenges when only one link of a proxy chain is protected, never returning the target", async () => {
    const open = document("open", false, "# Público");
    const secret = document("secret", true, "# Destino protegido");

    const protectedTarget = await setup({ raw: open, resolved: secret }).read.execute({ ...input, viewer: viewer("user").value });
    const protectedSource = await setup({ raw: secret, resolved: open }).read.execute({ ...input, viewer: viewer("user").value });

    for (const result of [protectedTarget, protectedSource]) {
      expect(result.kind).toBe("challenge");
      if (result.kind !== "challenge") throw new Error("unreachable");
      expect(result.document.getContent()).toBe("");
    }
  });

  it("reports not-found when the authorizer denies (for example a private nanobook of someone else)", async () => {
    const secured = document("doc-1", true);
    const privateNanobook: Policy = {
      appliesTo: ["document"],
      evaluate: async () => ({ effect: "deny", reason: "not-found" }),
    };

    const { read } = setup({ raw: secured, resolved: secured }, [nanobookPolicy, privateNanobook]);

    expect(await read.execute({ ...input, viewer: viewer("owner").value })).toEqual({ kind: "not-found" });
  });

  it("propagates an AccessCheckFailedError instead of conceding or challenging", async () => {
    const secured = document("doc-1", true);
    const broken: Policy = {
      appliesTo: ["document"],
      evaluate: async () => {
        throw new Error("db caída");
      },
    };

    const { read } = setup({ raw: secured, resolved: secured }, [nanobookPolicy, broken]);

    await expect(read.execute({ ...input, viewer: viewer("owner").value })).rejects.toBeInstanceOf(AccessCheckFailedError);
  });
});
