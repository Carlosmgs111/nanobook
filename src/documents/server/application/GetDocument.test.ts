import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { ProxyParser } from "./ProxyParser";
import type { DocumentSourceCache } from "./DocumentSourceCache";
import { GetDocument } from "./GetDocument";

const passthroughCache = (): DocumentSourceCache => ({
  getOrLoad: (_nanobookId, _path, load) => load(),
  invalidateNanobook: vi.fn(),
});

describe("GetDocument", () => {
  it("normalizes URL paths before looking up a document", async () => {
    const document = Document.create(
      "guides/index",
      {
        id: "doc-guides",
        title: "Guides",
        description: "Guides index",
        createdAt: new Date("2026-01-01"),
      },
      "# Guides"
    ).getValue();
    const getByPublicPath = vi.fn().mockResolvedValue(Result.ok(document));
    const repository = {
      getByPublicPath,
    } as unknown as ContentRepository;
    const proxyParser = {
      parseProxies: vi.fn().mockResolvedValue([document]),
    } as unknown as ProxyParser;

    const result = await new GetDocument(repository, proxyParser, passthroughCache()).execute(
      "book-a",
      "guides/index.md"
    );

    expect(result).toBe(document);
    expect(getByPublicPath).toHaveBeenCalledWith("book-a", "guides");
  });

  it("can load the source document without resolving its proxy", async () => {
    const document = Document.create(
      "new-dir/newfile3",
      {
        id: "doc-proxy",
        title: "Proxy",
        description: "Proxy",
        createdAt: new Date("2026-01-01"),
        ref: "/README.md",
      },
      ""
    ).getValue();
    const getByPublicPath = vi.fn().mockResolvedValue(Result.ok(document));
    const repository = { getByPublicPath } as unknown as ContentRepository;
    const parseProxies = vi.fn();
    const proxyParser = { parseProxies } as unknown as ProxyParser;

    const result = await new GetDocument(repository, proxyParser, passthroughCache()).executeRaw(
      "book-a",
      "new-dir/newfile3"
    );

    expect(result).toBe(document);
    expect(getByPublicPath).toHaveBeenCalledWith("book-a", "new-dir/newfile3");
    expect(parseProxies).not.toHaveBeenCalled();
  });

  it("reports lookup and proxy resolution durations separately", async () => {
    const document = Document.create(
      "guide",
      {
        id: "doc-guide",
        title: "Guide",
        description: "Guide",
        createdAt: new Date("2026-01-01"),
      },
      "# Guide"
    ).getValue();
    const repository = {
      getByPublicPath: vi.fn().mockResolvedValue(Result.ok(document)),
    } as unknown as ContentRepository;
    const proxyParser = {
      parseProxies: vi.fn().mockResolvedValue([document]),
    } as unknown as ProxyParser;
    const timings: Record<string, number> = {};

    const result = await new GetDocument(repository, proxyParser, passthroughCache()).execute(
      "book-a",
      "guide",
      (name, duration) => {
        timings[name] = duration;
      },
    );

    expect(result).toBe(document);
    expect(timings["document-lookup"]).toEqual(expect.any(Number));
    expect(timings["document-proxy"]).toEqual(expect.any(Number));
  });

  it("resolves a proxy after retrieving its source from the document cache", async () => {
    const source = Document.create("proxy", {
      id: "doc-proxy", title: "Proxy", description: "Proxy",
      createdAt: new Date("2026-01-01"), ref: "./target.md",
    }, "").getValue();
    const resolved = Document.create("proxy", {
      id: "doc-proxy", title: "Resolved", description: "Resolved",
      createdAt: new Date("2026-01-01"), ref: "./target.md",
    }, "# Current target").getValue();
    const repository = { getByPublicPath: vi.fn() } as unknown as ContentRepository;
    const cache: DocumentSourceCache = {
      getOrLoad: vi.fn(async () => Result.ok(source)),
      invalidateNanobook: vi.fn(),
    };
    const proxyParser = {
      parseProxies: vi.fn().mockResolvedValue([resolved]),
    } as unknown as ProxyParser;

    const result = await new GetDocument(repository, proxyParser, cache).execute("book-a", "proxy");

    expect(result).toBe(resolved);
    expect(proxyParser.parseProxies).toHaveBeenCalledWith("book-a", [source]);
    expect(repository.getByPublicPath).not.toHaveBeenCalled();
  });
});
