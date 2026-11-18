import { describe, expect, it, vi } from "vitest";
import { Document } from "../domain/Document";
import type { ReferenceResolver } from "../domain/reference/types";
import type { ContentEntry, DocumentMetadata } from "../domain/types";
import { ProxyParser } from "./ProxyParser";

const date = new Date("2026-01-01");

function metadata(overrides: Partial<DocumentMetadata> = {}): DocumentMetadata {
  return { title: "T", description: "D", createdAt: date, updatedAt: date, ...overrides };
}

function source(overrides: Partial<DocumentMetadata> = {}) {
  return Document.create("atajo", metadata({ id: "source-id", ownerId: "source-owner", ref: "./destino", ...overrides }), "").getValue();
}

const resolverOf = (entry: ContentEntry | null): ReferenceResolver => ({ resolve: vi.fn(async () => entry) });

describe("ProxyParser", () => {
  it("replaces the content with the target's and keeps the source ref and owner", async () => {
    const target = { data: metadata({ title: "Destino", ownerId: "target-owner" }), body: "# Destino" };

    const [resolved] = await new ProxyParser([resolverOf(target)]).parseProxies("book", [source()]);

    expect(resolved.getContent()).toBe("# Destino");
    expect(resolved.getTitle()).toBe("Destino");
    expect(resolved.getMetadata().ref).toBe("./destino");
    expect(resolved.getMetadata().ownerId).toBe("source-owner");
  });

  it("inherits the identity and protection of a protected target", async () => {
    const target = { data: metadata({ id: "target-id", secured: true }), body: "# Reservado" };

    const [resolved] = await new ProxyParser([resolverOf(target)]).parseProxies("book", [source()]);

    expect(resolved.getMetadata().secured).toBe(true);
    expect(resolved.getDocumentId().getValue()).toBe("target-id");
  });

  it("returns the stored document when the ref is missing, unresolved or chained", async () => {
    const original = source();
    const chained = { data: metadata({ ref: "./otro" }), body: "x" };

    expect((await new ProxyParser([resolverOf(null)]).parseProxies("book", [original]))[0]).toBe(original);
    expect((await new ProxyParser([resolverOf(chained)]).parseProxies("book", [original]))[0]).toBe(original);
    const plain = Document.create("plano", metadata({ id: "plain" }), "# Plano").getValue();
    expect((await new ProxyParser([resolverOf(null)]).parseProxies("book", [plain]))[0]).toBe(plain);
  });

  it("falls back to the stored document when a resolver throws, and the first resolver with a result wins", async () => {
    const original = source();
    const failing: ReferenceResolver = { resolve: async () => { throw new Error("boom"); } };
    expect((await new ProxyParser([failing]).parseProxies("book", [original]))[0]).toBe(original);

    const first = resolverOf({ data: metadata({ title: "Primero" }), body: "1" });
    const second = resolverOf({ data: metadata({ title: "Segundo" }), body: "2" });
    const [resolved] = await new ProxyParser([resolverOf(null), first, second]).parseProxies("book", [original]);
    expect(resolved.getContent()).toBe("1");
    expect(second.resolve).not.toHaveBeenCalled();
  });
});
