import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({ REDIS_URL: undefined }));

import { Document } from "../../domain/Document";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import { GitHubRepository } from "./GitHubRepository";

const parser: DocumentParser = {
  parseDocument(document) {
    return {
      headings: document
        .getContent()
        .split("\n")
        .filter((line) => line.startsWith("## "))
        .map((line) => ({ depth: 2, slug: line.slice(3), text: line.slice(3) })),
    };
  },
};

describe("GitHubRepository", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a cached document current and parsed after GitHub confirms its update", async () => {
    const remoteDocument = `---
title: "Original cache"
description: "Initial document"
date: 2026-09-24
author: "Nanobook"
index: false
---
## Original heading
`;
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/git/trees/")) {
        return Response.json({
          tree: [
            {
              path: "content/guides/cache.md",
              mode: "100644",
              type: "blob",
              sha: "file-sha",
              url: "https://api.github.com/repos/nanobook-test/cache/git/blobs/file-sha",
              size: remoteDocument.length,
            },
          ],
        });
      }

      if (url.includes("/contents/") && init?.method === "PUT") {
        return new Response(null, { status: 200 });
      }

      if (url.includes("/contents/")) {
        return Response.json({ sha: "file-sha" });
      }

      return new Response(remoteDocument, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const repository = new GitHubRepository(
      {
        owner: "nanobook-test",
        repo: "cache-update",
        path: "content",
        cacheTtl: 60_000,
      },
      parser
    );
    const updated = Document.create(
      "guides/cache",
      {
        title: "Updated cache",
        description: "Updated document",
        date: new Date("2026-09-24T00:00:00.000Z"),
        author: "Nanobook",
        index: false,
      },
      "## Updated heading\n"
    );

    expect(updated.isSuccess).toBe(true);
    await repository.list();

    const updateResult = await repository.update(updated.getValue());
    const documentResult = await repository.getById("guides/cache");

    expect(updateResult.isSuccess).toBe(true);
    expect(documentResult.isSuccess).toBe(true);
    expect(documentResult.getValue()?.getTitle()).toBe("Updated cache");
    expect(documentResult.getValue()?.getHeadings()).toEqual([
      { depth: 2, slug: "Updated heading", text: "Updated heading" },
    ]);
  });
});
