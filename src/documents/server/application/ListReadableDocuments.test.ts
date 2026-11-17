import { describe, expect, it, vi } from "vitest";
import { createAuthorizer, type Policy } from "../../../authorization/server";
import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { AccessGrantCodec, DocumentAccessRepository } from "../domain/access/ports";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import { DocumentPasswordPolicy } from "./access/DocumentPasswordPolicy";
import { ListReadableDocuments } from "./ListReadableDocuments";
import type { ProxyParser } from "./ProxyParser";

function doc(id: string, secured: boolean, content: string) {
  const date = new Date("2026-01-01");
  return Document.create(id, { id, title: id, description: "Descripción", secured, createdAt: date, updatedAt: date }, content).getValue();
}

/** Hace de política del módulo dueño del nanobook: permite `read` y deja `write` solo al usuario `owner`. */
const nanobookPolicy: Policy = {
  appliesTo: ["document"],
  evaluate: async ({ action, subject }) => {
    if (action === "read") return { effect: "allow" };
    return (await subject.userId()) === "owner" ? { effect: "allow" } : { effect: "abstain" };
  },
};

function setup(raw: Document[], resolved: Document[] = raw, extraPolicies: Policy[] = [nanobookPolicy]) {
  const repository = { list: vi.fn().mockResolvedValue(Result.ok(raw)) } as unknown as ContentRepository;
  const proxyParser = { parseProxies: vi.fn().mockResolvedValue(resolved) } as unknown as ProxyParser;
  const accessRepository = {
    get: async (documentId: string) => Result.ok({ documentId, passwordHash: "hash", passwordVersion: 1 }),
  } as unknown as DocumentAccessRepository;
  const codec = { verify: () => false } as unknown as AccessGrantCodec;
  const authorizer = createAuthorizer([new DocumentPasswordPolicy(accessRepository, codec), ...extraPolicies]);
  const authorize = vi.spyOn(authorizer, "authorize");
  return { list: new ListReadableDocuments(repository, proxyParser, authorizer), authorize };
}

describe("ListReadableDocuments", () => {
  const open = () => doc("abierto", false, "# Abierto");
  const secret = () => doc("secreto", true, "# Secreto");

  it("includes open documents without consulting the authorizer", async () => {
    const docs = [open(), doc("otro", false, "# Otro")];
    const { list, authorize } = setup(docs);

    expect(await list.execute("book", { userId: "user" })).toEqual(docs);
    expect(authorize).not.toHaveBeenCalled();
  });

  it("returns protected documents complete to a writer", async () => {
    const docs = [open(), secret()];
    const { list, authorize } = setup(docs);

    expect(await list.execute("book", { userId: "owner" })).toEqual(docs);
    expect(authorize).toHaveBeenCalledTimes(1); // solo el documento protegido; el abierto no consulta
  });

  it("redacts protected documents for readers who are not writers", async () => {
    const docs = [open(), secret()];

    for (const userId of ["user", undefined, ""]) {
      const result = await setup(docs).list.execute("book", { userId });
      expect(result[0]).toBe(docs[0]);
      expect(result[1].getContent()).toBe("");
      expect(result[1].getDescription()).toBe("");
      expect(result[1].getMetadata().secured).toBe(true);
    }
  });

  it("excludes the protected documents the authorizer denies", async () => {
    const privateNanobook: Policy = { appliesTo: ["document"], evaluate: async () => ({ effect: "deny", reason: "not-found" }) };
    const docs = [open(), secret()];

    const result = await setup(docs, docs, [nanobookPolicy, privateNanobook]).list.execute("book", { userId: "owner" });

    expect(result).toEqual([docs[0]]);
  });

  it("redacts when either link of a proxy is protected", async () => {
    const protectedTarget = await setup([doc("p", false, "")], [doc("p", true, "# secreto")]).list.execute("book", { userId: "user" });
    const protectedSource = await setup([doc("p", true, "")], [doc("p", false, "# destino")]).list.execute("book", { userId: "user" });

    expect(protectedTarget[0].getContent()).toBe("");
    expect(protectedSource[0].getContent()).toBe("");
  });

  it("returns an empty list when the repository fails", async () => {
    const repository = { list: vi.fn().mockResolvedValue(Result.fail(new Error("db"))) } as unknown as ContentRepository;
    const authorizer = createAuthorizer([nanobookPolicy]);
    const list = new ListReadableDocuments(repository, { parseProxies: vi.fn() } as unknown as ProxyParser, authorizer);

    expect(await list.execute("book", { userId: "user" })).toEqual([]);
  });
});
