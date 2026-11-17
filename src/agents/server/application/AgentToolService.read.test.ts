import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../../../documents/server/domain/Document";
import { DocumentAccessDeniedError, DocumentNotFoundError } from "../../../documents/server/domain/errors";
import type { Authorizer } from "../../../authorization/server";
import type { NanobookModule } from "../../../nanobooks/server";
import { createMarkdownBlockAdvisor } from "../../../application/server/createMarkdownBlockAdvisor";
import type { AgentActor } from "./dto";
import { AgentToolService } from "./AgentToolService";

const reader: AgentActor = { actorId: "visitante", oauthClientId: "claude", scopes: ["nanobooks:read"] };
const owner: AgentActor = { actorId: "dueño", oauthClientId: "claude", scopes: ["nanobooks:read"] };

function secured() {
  return Document.create(
    "guia",
    { id: "doc-1", title: "Guía", description: "d", secured: true, createdAt: new Date("2026-01-01") },
    "# Secreto",
  ).getValue();
}

function setup(readResult: unknown) {
  const readDocument = { execute: vi.fn().mockResolvedValue(readResult) };
  const listReadableDocuments = { execute: vi.fn().mockResolvedValue([]) };
  const nanobooks = {
    documentModule: { readDocument, listReadableDocuments },
  } as unknown as NanobookModule;
  const authorizer = { require: vi.fn().mockResolvedValue(Result.ok()) } as unknown as Authorizer;
  const tools = new AgentToolService(nanobooks, { write: vi.fn() }, createMarkdownBlockAdvisor(), authorizer);
  return { tools, readDocument, listReadableDocuments };
}

describe("AgentToolService reads respect document protection", () => {
  it("denies a protected document when the module challenges", async () => {
    const { tools } = setup({ kind: "challenge", method: "password", document: secured().redacted() });

    const result = await tools.getDocument(reader, "book-a", "guia");

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(DocumentAccessDeniedError);
  });

  it("reports a missing document", async () => {
    const { tools } = setup({ kind: "not-found" });

    const result = await tools.getDocument(reader, "book-a", "guia");

    expect(result.getError()).toBeInstanceOf(DocumentNotFoundError);
  });

  it("returns the document when access is allowed", async () => {
    const { tools } = setup({ kind: "allowed", document: secured(), via: "writer" });

    const result = await tools.getDocument(owner, "book-a", "guia");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().content).toBe("# Secreto");
  });

  it("identifies the actor to the module and presents no grants", async () => {
    const { tools, readDocument } = setup({ kind: "not-found" });

    await tools.getDocument(owner, "book-a", "guia");
    await tools.getDocument(reader, "book-a", "guia");

    const [ownerViewer, readerViewer] = readDocument.execute.mock.calls.map((call) => call[0].viewer);
    expect(await ownerViewer.userId()).toBe("dueño");
    expect(await readerViewer.userId()).toBe("visitante");
    expect(readerViewer.grantFor("doc-1")).toBeUndefined();
  });

  it("lists on behalf of the actor and lets the module decide what is readable", async () => {
    const { tools, listReadableDocuments } = setup({ kind: "not-found" });

    await tools.listDocuments(owner, "book-a");
    await tools.listDocuments(reader, "book-a");

    expect(listReadableDocuments.execute).toHaveBeenNthCalledWith(1, "book-a", { userId: "dueño" });
    expect(listReadableDocuments.execute).toHaveBeenNthCalledWith(2, "book-a", { userId: "visitante" });
  });
});
