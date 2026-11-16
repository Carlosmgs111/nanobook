import { describe, expect, it, vi } from "vitest";

import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { DocumentSourceCache } from "./DocumentSourceCache";
import { GetDocument } from "./GetDocument";
import type { ProxyParser } from "./ProxyParser";

const passthroughCache = (): DocumentSourceCache => ({
  getOrLoad: (_nanobookId, _path, load) => load(),
  invalidateNanobook: vi.fn(),
});

function doc(id: string, title: string) {
  return Document.create(
    "proxy",
    { id, title, description: title, createdAt: new Date("2026-01-01") },
    "",
  ).getValue();
}

describe("GetDocument.executeChain", () => {
  it("returns the stored document and its proxy-resolved version from one lookup", async () => {
    const raw = doc("doc-proxy", "Origen");
    const resolved = doc("doc-proxy", "Destino");
    const getByPublicPath = vi.fn().mockResolvedValue(Result.ok(raw));
    const parseProxies = vi.fn().mockResolvedValue([resolved]);
    const getDocument = new GetDocument(
      { getByPublicPath } as unknown as ContentRepository,
      { parseProxies } as unknown as ProxyParser,
      passthroughCache(),
    );

    const chain = await getDocument.executeChain("book-a", "proxy");

    expect(chain).toEqual({ raw, resolved });
    expect(getByPublicPath).toHaveBeenCalledTimes(1);
    expect(parseProxies).toHaveBeenCalledWith("book-a", [raw]);
  });

  it("returns null when the document does not exist", async () => {
    const getDocument = new GetDocument(
      { getByPublicPath: vi.fn().mockResolvedValue(Result.ok(null)) } as unknown as ContentRepository,
      { parseProxies: vi.fn() } as unknown as ProxyParser,
      passthroughCache(),
    );

    expect(await getDocument.executeChain("book-a", "missing")).toBeNull();
  });

  it("reports lookup and proxy durations", async () => {
    const raw = doc("doc-1", "Doc");
    const getDocument = new GetDocument(
      { getByPublicPath: vi.fn().mockResolvedValue(Result.ok(raw)) } as unknown as ContentRepository,
      { parseProxies: vi.fn().mockResolvedValue([raw]) } as unknown as ProxyParser,
      passthroughCache(),
    );
    const timings: Record<string, number> = {};

    await getDocument.executeChain("book-a", "proxy", (name, duration) => {
      timings[name] = duration;
    });

    expect(timings["document-lookup"]).toEqual(expect.any(Number));
    expect(timings["document-proxy"]).toEqual(expect.any(Number));
  });
});
