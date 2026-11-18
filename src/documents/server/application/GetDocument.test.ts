import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import { InMemoryDocumentSourceCache } from "../infraestructure/cache/InMemoryDocumentSourceCache";
import { GetDocument } from "./GetDocument";
import type { ProxyParser } from "./ProxyParser";

function doc(path: string, id: string, title = id) {
  const date = new Date("2026-01-01");
  return Document.create(path, { id, title, description: title, createdAt: date, updatedAt: date }, "# " + title).getValue();
}

function setup(stored: Document | null, resolved?: Document) {
  const getByPublicPath = vi.fn().mockResolvedValue(Result.ok(stored));
  const parseProxies = vi.fn(async (_book: string, docs: Document[]) => (resolved ? [resolved] : docs));
  const cache = new InMemoryDocumentSourceCache();
  const getDocument = new GetDocument(
    { getByPublicPath } as unknown as ContentRepository,
    { parseProxies } as unknown as ProxyParser,
    cache,
  );
  return { getDocument, getByPublicPath, parseProxies, cache };
}

describe("GetDocument", () => {
  it("normalizes the URL path and returns null for missing documents", async () => {
    const { getDocument, getByPublicPath } = setup(doc("guides/index", "g"));

    expect((await getDocument.execute("book", "guides/index.md"))?.getTitle()).toBe("g");
    expect(getByPublicPath).toHaveBeenCalledWith("book", "guides");
    expect(await setup(null).getDocument.execute("book", "missing")).toBeNull();
  });

  it("returns the stored document and its proxy-resolved version from a single lookup", async () => {
    const raw = doc("atajo", "proxy", "Origen");
    const resolved = doc("atajo", "proxy", "Destino");
    const { getDocument, getByPublicPath, parseProxies } = setup(raw, resolved);
    const timings: string[] = [];

    const chain = await getDocument.executeChain("book", "atajo", (name) => timings.push(name));

    expect(chain).toEqual({ raw, resolved });
    expect(getByPublicPath).toHaveBeenCalledTimes(1);
    expect(parseProxies).toHaveBeenCalledWith("book", [raw]);
    expect(timings).toEqual(["document-lookup", "document-proxy"]);
  });

  it("executeRaw skips proxy resolution", async () => {
    const { getDocument, parseProxies } = setup(doc("atajo", "proxy"), doc("atajo", "proxy", "Destino"));

    expect((await getDocument.executeRaw("book", "atajo"))?.getTitle()).toBe("proxy");
    expect(parseProxies).not.toHaveBeenCalled();
  });

  it("serves repeated reads from the source cache until the nanobook is invalidated", async () => {
    const { getDocument, getByPublicPath, cache } = setup(doc("guide", "guide"));

    await getDocument.executeRaw("book", "guide");
    await getDocument.executeRaw("book", "guide");
    expect(getByPublicPath).toHaveBeenCalledTimes(1);

    await cache.invalidateNanobook("book");
    await getDocument.executeRaw("book", "guide");
    expect(getByPublicPath).toHaveBeenCalledTimes(2);

    await getDocument.executeRaw("other-book", "guide");
    expect(getByPublicPath).toHaveBeenCalledTimes(3);
  });
});
