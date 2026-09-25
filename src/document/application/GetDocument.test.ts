import { describe, expect, it, vi } from "vitest";
import { Result } from "../../shared/domain/Result";
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
        date: new Date("2026-01-01"),
        index: true,
      },
      "# Guides"
    ).getValue();
    const getByPath = vi.fn().mockResolvedValue(Result.ok(document));
    const repository = {
      getByPath,
    } as unknown as ContentRepository;
    const proxyParser = {
      parseProxies: vi.fn().mockResolvedValue([document]),
    } as unknown as ProxyParser;

    const result = await new GetDocument(repository, proxyParser).execute(
      "guides/index.md"
    );

    expect(result).toBe(document);
    expect(getByPath).toHaveBeenCalledWith("guides");
  });
});
