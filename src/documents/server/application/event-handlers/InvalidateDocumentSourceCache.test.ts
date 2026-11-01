import { describe, expect, it, vi } from "vitest";
import { DocumentUpdated } from "../../domain/events/DocumentUpdated";
import { InvalidateDocumentSourceCache } from "./InvalidateDocumentSourceCache";

describe("InvalidateDocumentSourceCache", () => {
  it("changes the nanobook version for a document event", async () => {
    const sourceCache = { invalidateNanobook: vi.fn(async () => undefined) };
    const handler = new InvalidateDocumentSourceCache(sourceCache);

    const result = await handler.handle(new DocumentUpdated("doc-1", "book-a"));

    expect(result.isSuccess).toBe(true);
    expect(sourceCache.invalidateNanobook).toHaveBeenCalledWith("book-a");
  });

  it("ignores legacy events that do not identify a nanobook", async () => {
    const sourceCache = { invalidateNanobook: vi.fn(async () => undefined) };
    const handler = new InvalidateDocumentSourceCache(sourceCache);

    const result = await handler.handle(new DocumentUpdated("doc-1"));

    expect(result.isSuccess).toBe(true);
    expect(sourceCache.invalidateNanobook).not.toHaveBeenCalled();
  });
});
