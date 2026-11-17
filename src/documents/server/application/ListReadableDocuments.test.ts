import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { ListReadableDocuments } from "./ListReadableDocuments";
import type { ProxyParser } from "./ProxyParser";
import { allowWrites, denyWrites } from "./test/factories";

function doc(id: string, secured: boolean, content: string) {
  const date = new Date("2026-01-01");
  return Document.create(id, { id, title: id, description: "Descripción", secured, createdAt: date, updatedAt: date }, content).getValue();
}

function setup(raw: Document[], resolved: Document[] = raw, writeAccess: WriteAccess = denyWrites) {
  const repository = { list: vi.fn().mockResolvedValue(Result.ok(raw)) } as unknown as ContentRepository;
  const proxyParser = { parseProxies: vi.fn().mockResolvedValue(resolved) } as unknown as ProxyParser;
  return new ListReadableDocuments(repository, proxyParser, writeAccess);
}

describe("ListReadableDocuments", () => {
  const open = () => doc("abierto", false, "# Abierto");
  const secret = () => doc("secreto", true, "# Secreto");

  it("returns every resolved document to a writer", async () => {
    const docs = [open(), secret()];
    expect(await setup(docs, docs, allowWrites).execute("book", { userId: "user" })).toEqual(docs);
  });

  it("redacts protected documents for everyone else without asking the write port about anonymous readers", async () => {
    const docs = [open(), secret()];
    const require = vi.fn(denyWrites.require);

    for (const userId of ["user", undefined, ""]) {
      const result = await setup(docs, docs, { require } as unknown as WriteAccess).execute("book", { userId });
      expect(result[0]).toBe(docs[0]);
      expect(result[1].getContent()).toBe("");
      expect(result[1].getDescription()).toBe("");
      expect(result[1].getMetadata().secured).toBe(true);
    }
    expect(require).toHaveBeenCalledTimes(1);
  });

  it("redacts when either link of a proxy is protected", async () => {
    const protectedTarget = await setup([doc("p", false, "")], [doc("p", true, "# secreto")]).execute("book", { userId: "user" });
    const protectedSource = await setup([doc("p", true, "")], [doc("p", false, "# destino")]).execute("book", { userId: "user" });

    expect(protectedTarget[0].getContent()).toBe("");
    expect(protectedSource[0].getContent()).toBe("");
  });

  it("returns an empty list when the repository fails", async () => {
    const repository = { list: vi.fn().mockResolvedValue(Result.fail(new Error("db"))) } as unknown as ContentRepository;
    const list = new ListReadableDocuments(repository, { parseProxies: vi.fn() } as unknown as ProxyParser, denyWrites);

    expect(await list.execute("book", { userId: "user" })).toEqual([]);
  });
});
