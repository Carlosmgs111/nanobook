import { describe, expect, it, vi } from "vitest";
import { Result } from "../../../shared/domain/Result";
import { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { ProxyParser } from "./ProxyParser";
import { GetDocument } from "./GetDocument";

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

    const result = await new GetDocument(repository, proxyParser).execute(
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

    const result = await new GetDocument(repository, proxyParser).executeRaw(
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

    const result = await new GetDocument(repository, proxyParser).execute(
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
});
