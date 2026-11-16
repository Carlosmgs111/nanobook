import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { ListReadableDocuments } from "./ListReadableDocuments";
import type { ProxyParser } from "./ProxyParser";
import { allowWrites, denyWrites } from "./test/factories";

function doc(id: string, secured: boolean, content: string) {
  return Document.create(
    id,
    {
      id,
      title: id,
      description: "Descripción",
      secured,
      createdAt: new Date("2026-01-01"),
    },
    content,
  ).getValue();
}

function setup(raw: Document[], resolved: Document[] = raw, writeAccess: WriteAccess = denyWrites) {
  const repository = { list: vi.fn().mockResolvedValue(Result.ok(raw)) } as unknown as ContentRepository;
  const proxyParser = { parseProxies: vi.fn().mockResolvedValue(resolved) } as unknown as ProxyParser;
  return new ListReadableDocuments(repository, proxyParser, writeAccess);
}

describe("ListReadableDocuments", () => {
  it("returns every resolved document to a writer of the nanobook", async () => {
    const open = doc("abierto", false, "# Abierto");
    const secured = doc("secreto", true, "# Secreto");

    const result = await setup([open, secured], [open, secured], allowWrites).execute("book-a", { userId: "user-1" });

    expect(result).toEqual([open, secured]);
  });

  it("redacts protected documents for everyone else", async () => {
    const open = doc("abierto", false, "# Abierto");
    const secured = doc("secreto", true, "# Secreto");

    const result = await setup([open, secured]).execute("book-a", { userId: "user-2" });

    expect(result[0]).toBe(open);
    expect(result[1].getContent()).toBe("");
    expect(result[1].getDescription()).toBe("");
    expect(result[1].getMetadata().secured).toBe(true);
  });

  it("redacts protected documents for anonymous readers without asking the write port", async () => {
    const secured = doc("secreto", true, "# Secreto");
    const require = vi.fn();

    const result = await setup([secured], [secured], { require } as unknown as WriteAccess).execute("book-a", {
      userId: undefined,
    });

    expect(result[0].getContent()).toBe("");
    expect(require).not.toHaveBeenCalled();
  });

  it("redacts when only the stored link of a proxy is protected", async () => {
    const raw = doc("proxy", true, "");
    const resolved = doc("proxy", false, "# Contenido del destino");

    const result = await setup([raw], [resolved]).execute("book-a", { userId: "user-2" });

    expect(result[0].getContent()).toBe("");
  });

  it("returns an empty list when the repository fails", async () => {
    const repository = { list: vi.fn().mockResolvedValue(Result.fail(new Error("db"))) } as unknown as ContentRepository;
    const list = new ListReadableDocuments(repository, { parseProxies: vi.fn() } as unknown as ProxyParser, denyWrites);

    expect(await list.execute("book-a", { userId: "user-1" })).toEqual([]);
  });
});
