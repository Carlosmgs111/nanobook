import { describe, expect, it, vi } from "vitest";
import { DocumentCreated } from "../../domain/events/DocumentCreated";
import { DocumentDeleted } from "../../domain/events/DocumentDeleted";
import { DocumentUpdated } from "../../domain/events/DocumentUpdated";
import { InvalidateDocumentSourceCache } from "./InvalidateDocumentSourceCache";

const cacheWith = (invalidateNanobook: () => Promise<void>) => ({
  getOrLoad: vi.fn(),
  invalidateNanobook: vi.fn(invalidateNanobook),
});

describe("InvalidateDocumentSourceCache", () => {
  it.each([
    new DocumentCreated("doc-1", "book-a"),
    new DocumentUpdated("doc-1", "book-a"),
    new DocumentDeleted("doc-1", "book-a"),
  ])("invalidates the nanobook sources on $name", async (event) => {
    const sourceCache = cacheWith(async () => undefined);

    const result = await new InvalidateDocumentSourceCache(sourceCache).handle(event);

    expect(result.isSuccess).toBe(true);
    expect(sourceCache.invalidateNanobook).toHaveBeenCalledWith("book-a");
  });

  it("reports an event bus error when the cache cannot be invalidated", async () => {
    const sourceCache = cacheWith(async () => { throw new Error("offline"); });

    const result = await new InvalidateDocumentSourceCache(sourceCache).handle(new DocumentUpdated("doc-1", "book-a"));

    expect(result.isSuccess).toBe(false);
  });
});
